# GLBITM CDC Assessment Marks Leaderboard (Batch 2028)

A high-performance, dark-minimalist ranking and analytics platform indexing all **1,644 students** across 7 departments, ranked strictly by **Assessment Marks** (out of 1,500).

## 🚀 Quick Start

1. Double-click **`run_app.bat`** (or run `python server.py` in your terminal).
2. Open your browser at: **[http://localhost:5050](http://localhost:5050)**

---

## ✨ Features

- **Ranked Strictly on Assessment Marks**: Default and primary sorting by **Total Assessment Marks (out of 1,500)**, with individual breakdown for Assessment 1, 2, and 3.
- **Complete Cohort (1,644 Students)**: Complete data coverage across all 7 departments: **CSE**, **CS-AIML**, **CS-AI**, **CSDS**, **IT**, **ECE**, and **CSH**.
- **Live Instant Search**: Search by student name, roll number, or college email in real-time.
- **Branch-Wise & Group-Wise Filtering**: Filter by specific branch or CDC training group (`28ACSE G2`, `28CSIT Section A`, etc.).
- **Top 3 Assessment Podium**: Gold, Silver, and Bronze spotlight cards for the highest scoring students in the active view.
- **Detailed Assessment Breakdown**: Direct columns for Assessment 1, Assessment 2, and Assessment 3 with visual aggregate progress.
- **Official CDC Report Card Modal**: Click **"View Card"** to inspect a student's full official performance report card.
- **Live Roll Number Lookup**: Live query tool to fetch real-time updates directly from the college Google Apps Script.
- **CSV Export**: Export the ranked assessment table to `.csv` with one click.

---

## 📁 File Structure

- `index.html` - Minimalist semantic UI with modern typography (`Instrument Serif`, `Plus Jakarta Sans`, `IBM Plex Mono`).
- `style.css` - Obsidian dark-minimalist stylesheet.
- `app.js` - Client-side assessment ranking, filtering, sorting, pagination, and modal logic.
- `server.py` - Local Python server serving `/api/students` and `/api/live-lookup`.
- `scraper.py` - Concurrent multi-threaded scraper indexing the full batch.
- `data/students.json` - Complete dataset containing 1,644 indexed students.
- `run_app.bat` - One-click launcher.
