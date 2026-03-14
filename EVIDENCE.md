# Evidence Files for Testing

This document lists all evidence files needed to test the Lexie legal intake system.

**Case Type:** Workplace Injury - Construction Site Fall

---

## 🎤 Demo Script - Quick Answers for Agent Questions

Use these responses when speaking with Lexie during a demo:

### Opening / What Happened?
> "I fell at a construction site. I was working on scaffolding and fell about 15 feet."

### Your Name?
> "Maria Santos" (or just "Maria")

### When did this happen?
> "February 8th, 2026" (or "about a month ago" / "early February")

### Where did it happen?
> "At a construction site in Riverside, California. It was called Riverside Medical Plaza."

### Who do you work for?
> "Titan Construction" (or "Titan Builders")

### What's your job?
> "I'm a carpenter. I've been doing construction for about 6 years."

### How did you fall?
> "I was installing drywall on the second floor. The scaffolding was missing guardrails - someone removed them and never put them back. I was reaching for a panel and the plank shifted under me. There was no safety harness either."

### What injuries did you have?
> "I broke my right wrist, got a concussion, and hurt my back pretty bad.

### Did you go to the hospital?
> "Yes, right away. Riverside General Hospital. Then I saw an orthopedic doctor, a neurologist, and I've been doing physical therapy."

### Are you still in pain?
> "Yes, my back still hurts and I get headaches from the concussion. The wrist is getting better but still weak."

### Have you been able to work?
> "No, I've been out of work for about 4 months now." (or "16 weeks")

### How much do you make?
> "$32 an hour, usually 40 hours a week."

### Were there any witnesses?
> "Yes, my coworker Carlos saw it happen. And an electrician named Jimmy was nearby too."

### Was your employer cited for safety violations?
> "Yes, OSHA came and cited them for missing guardrails and not providing fall protection. They got fined almost $50,000."

### Do you have the documents?
- **Incident report**: "Yes, I have a copy of the incident report from my employer."
- **Medical records**: "Yes, I have all my medical records from the hospital and doctors."
- **Photos**: "Yes, I have photos of the scaffolding and my injuries."
- **Workers comp**: "Yes, I filed a workers comp claim."

### What are your medical bills so far?
> "About $67,000 so far, and they said I might need surgery which could be another $45,000."

---

## Quick Overview

| Category | File Count | Format | Status |
|----------|------------|--------|--------|
| Incident Reports | 3 | PDF | ✅ Done |
| Medical Records | 5 | PDF | ✅ Done |
| **Medical Billing** | **5** | **PDF** | **✅ NEW** |
| Employment Records | 2 | PDF | ✅ Done |
| Photos | 2 | PNG | ✅ Done |
| Workers' Comp | 2 | PDF | ✅ Done |

**Note:** All dates updated to 2026 (incident date: February 8, 2026)

---

## 1. Incident & Safety Reports (PDF) ✅ DONE

Location: `evidence/`

| Filename | Status |
|----------|--------|
| `employer-incident-report.pdf` | ✅ |
| `osha-investigation.pdf` | ✅ |
| `witness-statements.pdf` | ✅ |

LaTeX source files (`.tex`) available for editing.

---

## 2. Medical Records (PDF) ✅ DONE

Location: `evidence/`

| Filename | Status |
|----------|--------|
| `medical-records-er.pdf` | ✅ |
| `medical-records-orthopedic.pdf` | ✅ |
| `medical-records-neurology.pdf` | ✅ |
| `medical-records-imaging.pdf` | ✅ |
| `medical-records-pt.pdf` | ✅ |

LaTeX source files (`.tex`) available for editing.

---

## 3. Medical Billing Statements (PDF) ✅ NEW

Location: `evidence/`

| Filename | Provider | Total | Status |
|----------|----------|-------|--------|
| `billing-er.pdf` | Riverside General Hospital | $17,820.00 | ✅ |
| `billing-orthopedic.pdf` | Riverside Specialty Orthopedics | $2,845.00 | ✅ |
| `billing-neurology.pdf` | Riverside Neurology Specialists | $2,630.00 | ✅ |
| `billing-imaging.pdf` | Riverside Diagnostic Imaging | $6,260.00 | ✅ |
| `billing-pt.pdf` | Riverside Center for Physical Therapy | $4,155.00 | ✅ |

**Total Medical Expenses: $33,710.00**

Each billing statement includes:
- Itemized CPT codes with descriptions
- ICD-10 diagnosis codes
- Line-item amounts
- Provider information
- Workers' Comp claim reference (WC-CA-2026-0892)

LaTeX source files (`.tex`) available in `evidence/latex/`.

To regenerate PDFs: `cd evidence/latex && pdflatex -output-directory=.. billing-*.tex`

---

## 4. Employment Records (PDF) ✅ DONE

Location: `evidence/`

| Filename | Status |
|----------|--------|
| `employment-records.pdf` | ✅ |
| `safety-training-records.pdf` | ✅ |

LaTeX source files (`.tex`) available for editing.

---

## 4. Photo Evidence (PNG) ✅ DONE

Location: `evidence/`

| Filename | Status |
|----------|--------|
| `safety-violations.png` | ✅ |
| `arm-fracture.png` | ✅ |

---

## 5. Workers' Compensation Documents (PDF) ✅ DONE

Location: `evidence/`

| Filename | Status |
|----------|--------|
| `workers-comp-claim.pdf` | ✅ |
| `ime-report.pdf` | ✅ |

LaTeX source files (`.tex`) available for editing.

---

## Case Facts Reference

Use these consistent facts when creating evidence files:

---

### 👤 Plaintiff Information

| Field | Value |
|-------|-------|
| **Full Name** | Maria Elena Santos |
| **Date of Birth** | March 14, 1988 |
| **Age at Incident** | 35 years old |
| **Address** | 2847 Maple Grove Dr, Apt 12, Riverside, CA 92501 |
| **Phone** | (951) 555-0147 |
| **Email** | maria.santos1988@gmail.com |
| **SSN (last 4)** | XXX-XX-4892 |
| **Occupation** | Carpenter / Construction Worker |
| **Years of Experience** | 6 years |

---

### 🏢 Employer Information

| Field | Value |
|-------|-------|
| **Company Name** | **Titan Construction LLC** |
| **DBA** | Titan Builders |
| **Address** | 1200 Commerce Way, Suite 300, Riverside, CA 92507 |
| **Phone** | (951) 555-8800 |
| **Owner/President** | Robert "Bob" Hartman |
| **HR Contact** | Sandra Mitchell, HR Director |
| **Hire Date** | January 15, 2022 |
| **Position** | Carpenter II |
| **Hourly Rate** | $32.00/hour |
| **Weekly Hours** | 40-45 hours |
| **Employee ID** | TC-2022-0147 |

---

### 👷 Supervisor & Witnesses

| Role | Name | Title |
|------|------|-------|
| **Direct Supervisor** | Dave Peterson | Site Foreman |
| **Project Manager** | Michael Chen | Senior PM |
| **Witness #1** | Carlos Ramirez | Carpenter (coworker) |
| **Witness #2** | James "Jimmy" O'Brien | Electrician |
| **Witness #3** | Angela Washington | Safety Coordinator (off-site that day) |

---

### 📍 Incident Details

| Field | Value |
|-------|-------|
| **Date** | February 8, 2024 |
| **Time** | 10:15 AM |
| **Project Name** | Riverside Medical Plaza - Phase 2 |
| **Project Address** | 450 Industrial Blvd, Riverside, CA 92507 |
| **Specific Location** | Building C, 2nd Floor, East Wing |
| **Fall Height** | Approximately 15 feet |
| **Weather** | Clear, 68°F |

**What Happened:**
> Maria was installing drywall panels on second-floor scaffolding in Building C. The scaffolding on the east side was missing guardrails - they had been removed the previous day and never replaced. While reaching to secure a panel, the unsecured plank beneath her shifted. Maria lost her balance and fell approximately 15 feet to the concrete floor below. No safety harness had been provided to workers that day, despite company policy requiring fall protection above 6 feet.

---

### 🏥 Injuries

| Injury | Details |
|--------|---------|
| **Distal Radius Fracture** | Right wrist (dominant hand) - required casting |
| **Grade 2 Concussion** | Post-concussion syndrome with headaches, dizziness |
| **Herniated Disc** | L4-L5 lumbar spine |
| **Contusions/Abrasions** | Back, left hip, left elbow |
| **Initial Pain Level** | 8/10 |

---

### 📅 Treatment Timeline

| Date | Event | Provider |
|------|-------|----------|
| 2024-02-08 | ER visit, X-rays, CT scan | Riverside General Hospital |
| 2024-02-10 | Orthopedic consult, cast applied | Dr. Kevin Park, MD |
| 2024-02-12 | Neurology evaluation | Dr. Sarah Goldstein, MD |
| 2024-02-15 | MRI - herniated disc confirmed | Riverside Imaging Center |
| 2024-02-19 | Physical therapy begins | ProMotion Physical Therapy |
| 2024-03-08 | Cast removed, OT starts | Dr. Kevin Park, MD |
| 2024-04-15 | Spine specialist consult | Dr. James Wu, MD |

---

### ⚠️ OSHA Safety Violations

| Violation | Citation |
|-----------|----------|
| Missing guardrails on scaffolding | 29 CFR 1926.451(g)(1) |
| Failure to provide fall protection | 29 CFR 1926.502(d) |
| Inadequate safety training | 29 CFR 1926.21(b)(2) |
| No competent person on site | 29 CFR 1926.451(f)(7) |

**OSHA Inspection #:** 1654892  
**Citation Date:** February 22, 2024  
**Proposed Penalties:** $47,500

---

### 💰 Damages

| Category | Amount |
|----------|--------|
| Medical Expenses (to date) | $67,400 |
| Lost Wages (16 weeks @ $32/hr × 40 hrs) | $20,480 |
| Future Medical (possible surgery) | $45,000 |
| Pain & Suffering (est.) | $85,000 |
| **Total Claimed** | **$217,880** |
| Permanent Impairment Rating | 12% whole person |

---

### 🏛️ Insurance Information

**Workers' Compensation:**
| Field | Value |
|-------|-------|
| Carrier | Hartford Insurance Company |
| Policy # | WC-2024-TIT-88421 |
| Claim # | HRT-2024-0892147 |
| Adjuster | Patricia "Patty" Morrison |
| Adjuster Phone | (800) 555-4000 ext 2847 |

**Employer General Liability:**
| Field | Value |
|-------|-------|
| Carrier | Liberty Mutual Insurance |
| Policy # | GL-TIT-2024-00147 |
| Policy Limits | $1,000,000 per occurrence |

---

## Folder Structure

```
evidence/
├── safety-violations.png              ✅
├── arm-fracture.png                   ✅
├── employer-incident-report.pdf       ✅  (+ .tex source)
├── osha-investigation.pdf             ✅  (+ .tex source)
├── witness-statements.pdf             ✅  (+ .tex source)
├── medical-records-er.pdf             ✅  (+ .tex source)
├── medical-records-orthopedic.pdf     ✅  (+ .tex source)
├── medical-records-neurology.pdf      ✅  (+ .tex source)
├── medical-records-imaging.pdf        ✅  (+ .tex source)
├── medical-records-pt.pdf             ✅  (+ .tex source)
├── employment-records.pdf             ✅  (+ .tex source)
├── safety-training-records.pdf        ✅  (+ .tex source)
├── workers-comp-claim.pdf             ✅  (+ .tex source)
└── ime-report.pdf                     ✅  (+ .tex source)
```

**To edit a PDF:** Edit the `.tex` file, then run `tectonic <filename>.tex` to regenerate.

---

## Why Work Injury is Better for Demo

1. **Multiple liable parties** → Employer, general contractor, equipment manufacturer
2. **Regulatory angle** → OSHA violations add weight and credibility
3. **Complex legal questions** → Workers' comp vs third-party negligence claim
4. **Rich document ecosystem** → Incident reports, safety records, witness statements
5. **Emotional resonance** → Employer negligence, worker vulnerability

---

## Update Evidence Mapping

After adding files, update `frontend/src/lib/evidence-mapping.ts`:

```typescript
export const evidenceMap: Record<string, EvidenceDocument> = {
  // Photos ✅
  'Safety Violations': {
    url: '/evidence/safety-violations.png',
    type: 'image',
  },
  'Injury Photos': {
    url: '/evidence/arm-fracture.png',
    type: 'image',
  },
  
  // PDFs (add as you create them)
  'Employer Incident Report': {
    url: '/evidence/employer-incident-report.pdf',
    type: 'pdf',
  },
  'OSHA Investigation': {
    url: '/evidence/osha-investigation.pdf',
    type: 'pdf',
  },
  // ... etc
};
```

