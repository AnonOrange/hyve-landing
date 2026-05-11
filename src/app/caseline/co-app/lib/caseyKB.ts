// Curated "essentials" CaSeY knowledge base for the Co-App.
// Intentionally a slim subset (~20 entries) of the desktop's ~80-entry
// knowledge base — keeps the mobile bundle under 50KB while still
// covering the questions a lawyer is most likely to whisper-search at
// counsel table. For the full corpus, the answer points back to the
// desktop app.

export interface KnowledgeEntry {
  id: string
  question: string
  altPhrases?: string[]
  keywords: string[]
  category: string
  answer: string
  citations?: string[]
}

export const CASEY_KB: KnowledgeEntry[] = [
  {
    id: 'fourth-amendment',
    question: 'What does the Fourth Amendment protect?',
    altPhrases: ['4th amendment', 'fourth amendment', 'illegal search'],
    keywords: ['fourth amendment', '4a', 'search', 'seizure', 'warrant'],
    category: 'Constitutional',
    answer:
      'Protects against unreasonable **searches and seizures**. Requires warrants on probable cause, describing with particularity the place to be searched and persons or things seized.\n\n**Remedy:** suppression + fruit of the poisonous tree (*Wong Sun v. U.S.*, 371 U.S. 471).\n\n**Key exceptions:** consent, exigent circumstances, automobile (*Carroll*), search incident to arrest (cabined by *Gant* for vehicles), plain view (*Horton*), *Terry* stop & frisk, inventory.',
    citations: ['U.S. Const. amend. IV', 'Wong Sun v. United States, 371 U.S. 471 (1963)'],
  },
  {
    id: 'miranda',
    question: 'When does Miranda apply?',
    altPhrases: ['miranda', 'right to remain silent', 'custodial interrogation'],
    keywords: ['miranda', 'custodial', 'interrogation', 'rights', 'silent'],
    category: 'Criminal Procedure',
    answer:
      '*Miranda v. Arizona*, 384 U.S. 436. Warnings required when a suspect is in **custody AND being interrogated**.\n\n**Custody:** would a reasonable person feel free to leave? (*Berkemer v. McCarty*).\n**Interrogation:** express questioning or its functional equivalent — words/actions reasonably likely to elicit incriminating response (*Rhode Island v. Innis*).\n\n**Public-safety exception** (*New York v. Quarles*). Statement in violation: suppression of the statement; physical fruits often admissible (*United States v. Patane*).',
    citations: ['Miranda v. Arizona, 384 U.S. 436', 'Rhode Island v. Innis, 446 U.S. 291'],
  },
  {
    id: 'hearsay-rule',
    question: 'What is hearsay?',
    altPhrases: ['hearsay', 'out of court statement'],
    keywords: ['hearsay', 'fre 801', 'out of court', 'truth of the matter'],
    category: 'Evidence',
    answer:
      '**FRE 801(c):** an out-of-court statement offered to prove the truth of the matter asserted. Inadmissible unless an exception or exclusion applies (FRE 802).\n\n**Common exclusions (FRE 801(d)):** prior inconsistent statement under oath, prior consistent statement to rebut, identification of a person, party admissions.\n\n**Common exceptions:**\n- Present sense impression (803(1))\n- Excited utterance (803(2))\n- Then-existing state of mind (803(3))\n- Statement for medical diagnosis (803(4))\n- Recorded recollection (803(5))\n- Business records (803(6))\n- Public records (803(8))\n- Forfeiture by wrongdoing (804(b)(6))',
    citations: ['FRE 801', 'FRE 802', 'FRE 803', 'FRE 804'],
  },
  {
    id: 'objection-leading',
    question: 'Leading question objection?',
    altPhrases: ['leading question', 'objection leading'],
    keywords: ['leading', 'fre 611', 'direct examination'],
    category: 'Trial Objections',
    answer:
      '**FRE 611(c):** Leading questions should not be used on direct examination except as necessary to develop the witness\'s testimony. Permitted on cross-examination and with hostile/adverse witnesses, or children.\n\n**Prompt:** "Objection, leading."\n**Rationale:** suggests the answer to the witness; not permitted on direct.',
    citations: ['FRE 611(c)'],
  },
  {
    id: 'objection-relevance',
    question: 'Relevance objection?',
    altPhrases: ['relevance objection', 'irrelevant'],
    keywords: ['relevance', 'relevant', 'fre 401', 'fre 402', 'fre 403'],
    category: 'Trial Objections',
    answer:
      '**FRE 401:** evidence is relevant if it has any tendency to make a fact more or less probable AND the fact is of consequence in determining the action.\n**FRE 402:** irrelevant evidence inadmissible.\n**FRE 403:** even relevant evidence excluded if probative value substantially outweighed by unfair prejudice, confusion, misleading the jury, undue delay, waste of time, or cumulative.\n\n**Prompt:** "Objection, relevance" or "Objection — 403."',
    citations: ['FRE 401', 'FRE 402', 'FRE 403'],
  },
  {
    id: 'character-evidence',
    question: 'When is character evidence admissible?',
    altPhrases: ['character evidence', 'prior bad acts'],
    keywords: ['character', '404', 'propensity', 'prior bad acts', '404(b)'],
    category: 'Evidence',
    answer:
      '**FRE 404(a):** Generally inadmissible to prove conformity (propensity).\n**FRE 404(b):** Other crimes/wrongs admissible for non-propensity purposes: **M**otive, **O**pportunity, **I**ntent, **P**reparation, **P**lan, **K**nowledge, **I**dentity, **A**bsence of mistake (MOIPPKIA / MIMIC).\n**Reverse 404(b):** defendant may offer to show another person had the motive/opportunity.\n**FRE 412 (rape shield):** complainant\'s sexual behavior generally inadmissible.\n**FRE 413-415:** prior sexual assault/child molestation admissible in those cases.',
    citations: ['FRE 404', 'FRE 412-415'],
  },
  {
    id: 'speedy-trial-act',
    question: 'Federal Speedy Trial Act deadlines?',
    altPhrases: ['speedy trial act', 'sta', '18 usc 3161'],
    keywords: ['speedy trial', 'sta', '70-day', '30-day', '3161'],
    category: 'Federal Procedure',
    answer:
      '**18 U.S.C. § 3161:**\n- **30 days** from arrest to information/indictment.\n- **70 days** from indictment OR first appearance (later of) to trial.\n- **Excludable time** (§ 3161(h)): pretrial motions pending, mental competency exam, plea negotiations, "ends of justice" continuances with on-the-record findings.\n- **Remedy** (§ 3162): dismissal with or without prejudice based on (1) seriousness of offense, (2) facts/circumstances of the delay, (3) impact of reprosecution.',
    citations: ['18 U.S.C. § 3161', '18 U.S.C. § 3162'],
  },
  {
    id: 'brady',
    question: 'Brady disclosure obligations?',
    altPhrases: ['brady', 'exculpatory evidence', 'giglio'],
    keywords: ['brady', 'exculpatory', 'giglio', 'kyles', 'impeachment'],
    category: 'Discovery',
    answer:
      '**Brady v. Maryland**, 373 U.S. 83. Prosecution must disclose evidence in its possession that is **favorable to the defense and material** to guilt or punishment.\n\n**Giglio v. U.S.** extends Brady to **impeachment evidence** (witness deals, prior inconsistent statements, criminal history of cooperators).\n\n**Kyles v. Whitley:** prosecutor\'s duty extends to evidence known to others acting on government\'s behalf (police, agencies).\n\n**Material** = reasonable probability of a different result.\n\n**Remedies:** new trial, dismissal, ineffective-assistance claim if late disclosure.',
    citations: ['Brady v. Maryland, 373 U.S. 83', 'Giglio v. U.S., 405 U.S. 150', 'Kyles v. Whitley, 514 U.S. 419'],
  },
  {
    id: 'confrontation-clause',
    question: 'Confrontation Clause / Crawford?',
    altPhrases: ['confrontation', 'crawford', 'testimonial'],
    keywords: ['confrontation', 'crawford', 'testimonial', 'sixth amendment'],
    category: 'Constitutional',
    answer:
      '**Crawford v. Washington**, 541 U.S. 36. **Testimonial** hearsay inadmissible unless:\n1. Declarant unavailable AND\n2. Defendant had **prior opportunity to cross-examine**.\n\n**Testimonial:** prior testimony, police interrogations, anything a reasonable person would expect to be used prosecutorially.\n**Non-testimonial:** statements made primarily to address an ongoing emergency (*Davis v. Washington*).\n\n**Forfeiture by wrongdoing** waives confrontation (*Giles*, FRE 804(b)(6)).',
    citations: ['Crawford v. Washington, 541 U.S. 36', 'Davis v. Washington, 547 U.S. 813'],
  },
  {
    id: 'sentencing-guidelines',
    question: 'How do federal sentencing guidelines work?',
    altPhrases: ['ussg', 'sentencing guidelines', 'guidelines range'],
    keywords: ['ussg', 'sentencing', 'guidelines', 'offense level', 'criminal history'],
    category: 'Sentencing',
    answer:
      '**USSG sentencing table:** intersection of **offense level (1-43)** and **criminal history category (I-VI)** gives a guideline range in months.\n\n**Acceptance of responsibility** (3E1.1): -2 or -3 levels.\n**Career Offender** (4B1.1): if instant offense + 2 priors are crimes of violence or controlled-substance offenses, criminal history goes to VI and offense level may climb to the table in 4B1.1(b).\n**ACCA** (18 U.S.C. § 924(e)): 3 violent-felony or serious-drug priors → 15-yr mandatory minimum on a 922(g) conviction.\n\nAfter *Booker*, guidelines are **advisory**. Court must still calculate the range and address § 3553(a) factors.',
    citations: ['USSG Ch. 5 Pt. A (Sentencing Table)', '18 U.S.C. § 3553(a)', 'United States v. Booker, 543 U.S. 220'],
  },
  {
    id: 'motion-to-suppress',
    question: 'How to draft a motion to suppress?',
    altPhrases: ['suppress', 'motion to suppress', 'suppression motion'],
    keywords: ['suppress', 'motion', 'exclude', 'fourth amendment'],
    category: 'Motions',
    answer:
      '**Standard structure:**\n1. **Introduction:** identify the evidence sought to be suppressed.\n2. **Statement of Facts:** specific facts about the encounter/search.\n3. **Legal Standard:** controlling law (e.g., FRE 41, *Terry*, *Carroll*).\n4. **Argument:**\n   - Step 1: Was there a search/seizure? (Reasonable expectation of privacy — *Katz*.)\n   - Step 2: Was it lawful? (Warrant + probable cause, or recognized exception.)\n   - Step 3: If unlawful, the evidence and any fruits must be suppressed.\n5. **Conclusion + Requested Relief.**\n\n**Defendant\'s burden:** standing (legitimate expectation of privacy) + that the search/seizure occurred.\n**Government\'s burden:** that the search/seizure was lawful.',
    citations: ['Katz v. United States, 389 U.S. 347', 'Fed. R. Crim. P. 12(b)(3)', 'Fed. R. Crim. P. 41'],
  },
  {
    id: 'bail',
    question: 'Federal bail / pretrial release?',
    altPhrases: ['bail', 'pretrial release', 'detention hearing', '3142'],
    keywords: ['bail', 'detention', 'release', '3142', 'pretrial'],
    category: 'Federal Procedure',
    answer:
      '**Bail Reform Act** (18 U.S.C. § 3142). **Presumption of release** on least restrictive conditions unless the government meets its burden for detention.\n\n**§ 3142(e) rebuttable presumption** of detention (against defendant) in:\n- Drug offenses w/ 10+ yr max\n- Crimes of violence\n- Offenses involving minor victims\n- 924(c) firearm offenses\n\n**Factors** (§ 3142(g)):\n1. Nature and circumstances of the offense\n2. Weight of the evidence\n3. History and characteristics of the defendant\n4. Nature and seriousness of danger to community\n\n**Hearing must be held at first appearance** — counsel can ask for a 3-day continuance, government for a 5-day continuance.',
    citations: ['18 U.S.C. § 3142'],
  },
]

export interface SearchHit {
  entry: KnowledgeEntry
  score: number
}

// Tiny keyword/phrase scorer. No model, no inference — just deterministic
// token overlap weighted by category match.
export function searchCaseyKB(query: string, limit = 3): SearchHit[] {
  const q = query.toLowerCase().trim()
  if (!q) return []

  const tokens = q.split(/\W+/).filter((t) => t.length > 2)
  const hits: SearchHit[] = []

  for (const entry of CASEY_KB) {
    let score = 0
    const haystack = [
      entry.question,
      entry.category,
      ...(entry.altPhrases ?? []),
      ...entry.keywords,
    ].join(' ').toLowerCase()

    // exact phrase match — heavy boost
    if (haystack.includes(q)) score += 50

    // alt-phrase exact match — strong boost
    for (const p of entry.altPhrases ?? []) {
      if (q.includes(p.toLowerCase())) score += 30
    }

    // keyword match
    for (const k of entry.keywords) {
      if (q.includes(k.toLowerCase())) score += 20
    }

    // token overlap with haystack
    for (const t of tokens) {
      if (haystack.includes(t)) score += 4
    }

    if (score > 0) hits.push({ entry, score })
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit)
}
