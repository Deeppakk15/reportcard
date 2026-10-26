import http.server
import socketserver
import urllib.parse
import json
import os
import requests

PORT = 5050
DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "students.json")
SCRIPT_URL = "https://script.google.com/macros/s/AKfycby860NNoT4AIX7_P0w60uz1J3CNTaSz5XcrxsAGsJN2oD13vltlUv-49F_qPbEGY2_0/callback?nocache_id=1"
HEADERS = {
    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    "Referer": "https://script.google.com/a/macros/glbitm.ac.in/s/AKfycby860NNoT4AIX7_P0w60uz1J3CNTaSz5XcrxsAGsJN2oD13vltlUv-49F_qPbEGY2_0/exec",
    "X-Same-Domain": "1",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

def parse_num(val):
    if not val or val == "-":
        return 0.0
    val_str = str(val).replace("%", "").strip()
    try:
        if "/" in val_str:
            return float(val_str.split("/")[0].strip())
        return float(val_str)
    except:
        return 0.0

def live_fetch(roll_no):
    payload_str = json.dumps(["getStudentReport", json.dumps([str(roll_no)]), None, [0], None, None, 1, 0])
    try:
        resp = requests.post(SCRIPT_URL, headers=HEADERS, data={"request": payload_str}, timeout=12)
        text = resp.text
        idx = text.find("[")
        if idx != -1:
            rpc_data = json.loads(text[idx:].strip())
            for item in rpc_data:
                if isinstance(item, list) and len(item) >= 2 and item[0] == "op.exec":
                    data = json.loads(item[1][1])
                    if data.get("success") and data.get("student"):
                        st = data["student"]
                        a1 = parse_num(st.get("assessment1"))
                        a2 = parse_num(st.get("assessment2"))
                        a3 = parse_num(st.get("assessment3"))
                        st["assessment1_num"] = a1
                        st["assessment2_num"] = a2
                        st["assessment3_num"] = a3
                        st["total_assessment"] = a1 + a2 + a3
                        st["cp_score_num"] = parse_num(st.get("cpScore"))
                        st["comm_score_num"] = parse_num(st.get("communicationScore"))
                        st["odd_attendance_num"] = parse_num(st.get("oddAttendance"))
                        return {"success": True, "student": st}
                    else:
                        return {"success": False, "message": data.get("message", "Student not found")}
    except Exception as e:
        return {"success": False, "message": str(e)}
    return {"success": False, "message": "Failed to query college server"}

class RankingHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/api/students":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            if os.path.exists(DATA_FILE):
                with open(DATA_FILE, "r", encoding="utf-8") as f:
                    self.wfile.write(f.read().encode("utf-8"))
            else:
                self.wfile.write(b"[]")
            return

        elif path == "/api/live-lookup":
            roll = query.get("roll", [""])[0].strip()
            if not roll:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": "Roll number required"}).encode("utf-8"))
                return

            res = live_fetch(roll)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(res).encode("utf-8"))
            return

        return super().do_GET()

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), RankingHandler) as httpd:
        print(f"Ranking server running at http://localhost:{PORT}")
        httpd.serve_forever()
