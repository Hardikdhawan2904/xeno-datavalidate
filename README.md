# DataValidate – Transaction Data Validation Platform

A browser-based CSV validation platform built for the Xeno Implementation Assignment 2026.

**Live Demo:** https://xeno-datavalidate.vercel.app/

**Walkthrough Video:** https://www.loom.com/share/d8bf38632f31460e94a0a48c684f1817

---

## Features

- **Upload** — Drag & drop or browse CSV files up to 100 MB
- **Column Mapping** — Auto-detect columns and configure validation rules
- **Phone Validation** — Country-specific digit count rules (e.g. India: 10 digits)
- **Date Validation** — Multiple accepted formats (YYYY-MM-DD, DD/MM/YYYY, etc.)
- **Email Validation** — Standard email format checking
- **Duplicate Detection** — Flags repeated Order IDs
- **Negative Amount Detection** — Flags invalid negative values
- **Required Fields** — Flags missing values in selected columns
- **Error Filtering** — Filter by error type, field name, or search keyword
- **Data Preview** — Full table view of all rows
- **Downloads** — Cleaned CSV, Full CSV with error column, or chunked ZIP

---

## How to Use

1. Upload your CSV file
2. Configure column mapping and validation rules
3. Click **Run Validation**
4. Review errors and download results

---

## Tech Stack

- HTML / CSS / JavaScript (no framework, no build step)
- JSZip for chunk ZIP downloads
- Deployed on Vercel

---

## Built By

Hardik Dhawan  
SRM Institute of Science and Technology  
B.Tech CSE – AI & ML  
Xeno Implementation Assignment 2026
