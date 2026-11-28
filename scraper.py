import requests
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
import os
import sys

sys.stdout.reconfigure(line_buffering=True)

URL = "https://script.google.com/macros/s/AKfycby860NNoT4AIX7_P0w60uz1J3CNTaSz5XcrxsAGsJN2oD13vltlUv-49F_qPbEGY2_0/callback?nocache_id=1"
HEADERS = {
    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    "Referer": "https://script.google.com/a/macros/glbitm.ac.in/s/AKfycby860NNoT4AIX7_P0w60uz1J3CNTaSz5XcrxsAGsJN2oD13vltlUv-49F_qPbEGY2_0/exec",
    "X-Same-Domain": "1",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "students.json")

def parse_score(val):
    if not val or val == "-":
        return 0.0
    val_str = str(val).replace("%", "").strip()
    try:
        if "/" in val_str:
            num, den = val_str.split("/")
            return float(num.strip())
        return float(val_str)
    except:
        return 0.0

def parse_rank(val):
    if not val or str(val).strip() == "-":
        return None
    try:
        n = int(float(str(val).strip()))
        return n if n > 0 else None
    except:
        return None

def fetch_single(roll_no, retries=3):
    payload_str = json.dumps(["getStudentReport", json.dumps([str(roll_no)]), None, [0], None, None, 1, 0])
    for attempt in range(retries):
        try:
            resp = requests.post(URL, headers=HEADERS, data={"request": payload_str}, timeout=10)
            text = resp.text
            idx = text.find("[")
            if idx != -1:
                rpc_data = json.loads(text[idx:].strip())
                for item in rpc_data:
                    if isinstance(item, list) and len(item) >= 2 and item[0] == "op.exec":
                        data = json.loads(item[1][1])
                        if data.get("success") and data.get("student"):
                            st = data["student"]
                            # Clean and calculate standardized metrics
                            a1 = parse_score(st.get("assessment1"))
                            a2 = parse_score(st.get("assessment2"))
                            a3 = parse_score(st.get("assessment3"))
                            raw_a4 = str(st.get("assessment4") or "").strip()
                            if raw_a4.startswith("http://") or raw_a4.startswith("https://"):
                                a4 = 0.0
                                st["leetcode_url"] = raw_a4
                            else:
                                a4 = parse_score(raw_a4)
                            st["assessment1_num"] = a1
                            st["assessment2_num"] = a2
                            st["assessment3_num"] = a3
                            st["assessment4_num"] = a4
                            st["total_assessment"] = a1 + a2 + a3 + a4
                            st["cp_score_num"] = parse_score(st.get("cpScore"))
                            st["comm_score_num"] = parse_score(st.get("communicationScore"))
                            st["odd_attendance_num"] = parse_score(st.get("oddAttendance"))
                            st["coding_rank_num"] = parse_rank(st.get("collegeCodingRank"))
                            return st
                        else:
                            # Explicitly not found / failed from server
                            return None
        except Exception:
            if attempt < retries - 1:
                time.sleep(0.5)
    return None

def save_students(students_list, path=DATA_PATH):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temp_path = path + ".tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(students_list, f, indent=2, ensure_ascii=False)
    if os.path.exists(path):
        os.replace(temp_path, path)
    else:
        os.rename(temp_path, path)

def scrape_branches(branch_configs, refresh=False):
    all_students_dict = {}
    
    # Load existing data if available
    if os.path.exists(DATA_PATH):
        try:
            with open(DATA_PATH, "r", encoding="utf-8") as f:
                existing = json.load(f)
                for st in existing:
                    if st.get("rollNo") and st.get("name"):
                        all_students_dict[st["rollNo"]] = st
            print(f"Loaded {len(all_students_dict)} existing student records from {DATA_PATH}")
        except Exception as e:
            print(f"Notice: Failed to load existing data ({e}). Starting fresh.")

    # Determine rolls to fetch
    rolls_to_fetch = []
    seen = set()
    if refresh:
        for r in sorted(all_students_dict.keys()):
            rolls_to_fetch.append(r)
            seen.add(r)
    for code, max_r in branch_configs.items():
        for i in range(1, max_r + 1):
            r = f"240192{code}{i:04d}"
            if r in seen:
                continue
            if refresh or r not in all_students_dict:
                rolls_to_fetch.append(r)
                seen.add(r)

    print(f"Total target rolls in config: {sum(branch_configs.values())}")
    print(f"Already cached: {len(all_students_dict)}")
    print(f"Rolls to fetch ({'refresh' if refresh else 'missing only'}): {len(rolls_to_fetch)}")

    if not rolls_to_fetch:
        print("All target rolls are already cached! No scraping needed.")
        return list(all_students_dict.values())

    print(f"Starting concurrent fetch with 35 workers...")
    start_time = time.time()
    updated_count = 0
    checked_count = 0
    total_to_fetch = len(rolls_to_fetch)

    with ThreadPoolExecutor(max_workers=35) as executor:
        futures = {executor.submit(fetch_single, r): r for r in rolls_to_fetch}
        for future in as_completed(futures):
            checked_count += 1
            st = future.result()
            if st and st.get("name"):
                prev = all_students_dict.get(st["rollNo"])
                if prev and not st.get("leetcode_url"):
                    prev_lc = prev.get("leetcode_url") or prev.get("assessment4")
                    if isinstance(prev_lc, str) and (prev_lc.startswith("http://") or prev_lc.startswith("https://")):
                        st["leetcode_url"] = prev_lc
                all_students_dict[st["rollNo"]] = st
                updated_count += 1
                if updated_count % 50 == 0:
                    print(f"Progress: [{checked_count}/{total_to_fetch}] Updated/Found {updated_count} students (Total in DB: {len(all_students_dict)})")
                    save_students(sorted(all_students_dict.values(), key=lambda x: x.get("rollNo", "")))

    elapsed = time.time() - start_time
    final_list = sorted(all_students_dict.values(), key=lambda x: x.get("rollNo", ""))
    save_students(final_list)

    print(f"\nScraping completed in {elapsed:.1f}s!")
    print(f"Students updated/found: {updated_count}")
    print(f"Total students now in database: {len(final_list)}")

    # Print breakdown by branch
    from collections import Counter
    branch_counts = Counter(s.get("branch", "Unknown") for s in final_list)
    print("\nStudent breakdown by branch:")
    for b, c in branch_counts.most_common():
        print(f"  {b}: {c} students")

    return final_list

if __name__ == "__main__":
    refresh_mode = "--refresh" in sys.argv
    # Complete branch definitions for batch 2024 at GLBITM
    branches = {
        "010": 372, # CSE (approx 368 actual)
        "013": 225, # IT (approx 220 actual)
        "152": 295, # CSAI (approx 291 actual)
        "153": 295, # CSAIML (approx 289 actual)
        "154": 295, # CSDS (approx 290 actual)
        "169": 75,  # CSH (approx 72 actual)
        "031": 145, # ECE (approx 142 actual)
    }
    scrape_branches(branches, refresh=refresh_mode)
