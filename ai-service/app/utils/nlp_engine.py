"""
NLP Engine for extracting and structuring medicine information
from OCR-extracted prescription text
"""
import re
import spacy
import logging
from typing import List, Dict, Optional, Tuple, Any
from fuzzywuzzy import fuzz, process

logger = logging.getLogger(__name__)

# ─── Common medicine database (expanded for Sri Lankan context) ──────────────
MEDICINE_DATABASE = [
    # Antibiotics
    "amoxicillin", "amoxiclav", "augmentin", "ampicillin", "azithromycin",
    "azithro", "ciprofloxacin", "cipro", "metronidazole", "flagyl",
    "doxycycline", "tetracycline", "cloxacillin", "cephalexin", "cefalexin",
    "cefuroxime", "ceftriaxone", "cotrimoxazole", "trimethoprim", "erythromycin",
    "clarithromycin", "nitrofurantoin", "levofloxacin", "meropenem",

    # Pain & Anti-inflammatory
    "paracetamol", "acetaminophen", "ibuprofen", "diclofenac", "naproxen",
    "aspirin", "mefenamic acid", "mefenamic", "tramadol", "codeine", "morphine",
    "indomethacin", "celecoxib", "ketorolac", "meloxicam",

    # Antihypertensives
    "amlodipine", "norvasc", "atenolol", "metoprolol", "losartan", "valsartan",
    "lisinopril", "enalapril", "ramipril", "captopril", "telmisartan",
    "hydrochlorothiazide", "furosemide", "lasix", "spironolactone", "nifedipine",
    "carvedilol", "bisoprolol", "candesartan", "olmesartan",

    # Antidiabetics
    "metformin", "glucophage", "glibenclamide", "glipizide", "gliclazide",
    "glimepiride", "insulin", "sitagliptin", "januvia", "empagliflozin",
    "jardiance", "dapagliflozin", "pioglitazone", "rosiglitazone",

    # Respiratory
    "salbutamol", "albuterol", "ventolin", "salmeterol", "formoterol",
    "budesonide", "beclomethasone", "fluticasone", "montelukast", "singulair",
    "theophylline", "ipratropium", "tiotropium",

    # Gastrointestinal
    "omeprazole", "pantoprazole", "lansoprazole", "ranitidine", "famotidine",
    "metoclopramide", "domperidone", "ondansetron", "loperamide", "lactulose",
    "sucralfate", "antacid", "aluminum hydroxide", "magnesium hydroxide",

    # Antihistamines
    "cetirizine", "loratadine", "fexofenadine", "chlorphenamine", "diphenhydramine",
    "promethazine", "hydroxyzine", "levocetirizine",

    # Vitamins & Supplements
    "vitamin c", "ascorbic acid", "vitamin d", "vitamin b12", "folic acid",
    "ferrous sulfate", "zinc", "calcium", "multivitamin", "vitamin b complex",
    "iron", "magnesium", "potassium",

    # Antifungals
    "fluconazole", "diflucan", "clotrimazole", "ketoconazole", "itraconazole",
    "voriconazole", "nystatin", "griseofulvin",

    # Neurological
    "carbamazepine", "phenytoin", "sodium valproate", "valproic acid",
    "levetiracetam", "gabapentin", "pregabalin", "lamotrigine",
    "diazepam", "lorazepam", "alprazolam", "clonazepam",
    "sertraline", "fluoxetine", "paroxetine", "escitalopram", "citalopram",
    "amitriptyline", "nortriptyline", "olanzapine", "risperidone", "haloperidol",

    # Thyroid
    "levothyroxine", "thyroxine", "methimazole", "carbimazole", "propylthiouracil",

    # Steroids
    "prednisolone", "prednisone", "dexamethasone", "hydrocortisone",
    "methylprednisolone", "betamethasone",

    # Eye/Ear
    "timolol", "latanoprost", "dorzolamide", "ciprofloxacin eye drops",
    "gentamicin eye drops", "artificial tears",

    # Topical
    "betamethasone cream", "clotrimazole cream", "hydrocortisone cream",
    "mupirocin", "silver sulfadiazine",
]

# ─── Dosage patterns ─────────────────────────────────────────────────────────
DOSAGE_PATTERNS = [
    r'\b(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|units?|%)\b',
    r'\b(\d+(?:\.\d+)?)\s*milligrams?\b',
    r'\b(\d+(?:\.\d+)?)\s*micrograms?\b',
    r'\b(\d+(?:\.\d+)?)\s*grams?\b',
]

# ─── Frequency patterns ───────────────────────────────────────────────────────
FREQUENCY_MAP = {
    r'\bod\b|once\s+daily|once\s+a\s+day|1[×x]\s*daily': 'Once daily (OD)',
    r'\bbd\b|\bbid\b|twice\s+daily|twice\s+a\s+day|2[×x]\s*daily': 'Twice daily (BD)',
    r'\btds\b|\btid\b|three\s+times\s+daily|3[×x]\s*daily': 'Three times daily (TDS)',
    r'\bqid\b|four\s+times\s+daily|4[×x]\s*daily': 'Four times daily (QID)',
    r'\bstat\b|immediately|at\s+once': 'Immediately (STAT)',
    r'\bprn\b|as\s+needed|when\s+required|when\s+necessary': 'As needed (PRN)',
    r'\bhs\b|at\s+bedtime|at\s+night|nocte': 'At bedtime (HS)',
    r'\bom\b|every\s+morning|morning': 'Every morning (OM)',
    r'\bon\b|every\s+night|night': 'Every night (ON)',
    r'\bqod\b|alternate\s+days|every\s+other\s+day': 'Alternate days',
    r'\bweekly\b|once\s+a\s+week': 'Once weekly',
}

# ─── Duration patterns ───────────────────────────────────────────────────────
DURATION_PATTERNS = [
    r'for\s+(\d+)\s*(days?|weeks?|months?)',
    r'(\d+)\s*(?:days?|weeks?|months?)\s+course',
    r'×\s*(\d+)\s*(days?|weeks?|months?)',
    r'x\s*(\d+)\s*(days?|weeks?|months?)',
]

# ─── Route patterns ──────────────────────────────────────────────────────────
ROUTE_PATTERNS = {
    r'\boral\b|\bpo\b|\bby\s+mouth\b|\btablets?\b|\bcapsules?\b': 'Oral',
    r'\btopical\b|\bapply\b|\bcream\b|\bointment\b|\bgel\b': 'Topical',
    r'\binjection\b|\bim\b|\biv\b|\bsubcut\b|\bsc\b': 'Injection',
    r'\binhaler\b|\binhalation\b|\bnebuliser\b|\bnebulizer\b': 'Inhalation',
    r'\beye\s*drops?\b|\bophthalmic\b': 'Ophthalmic',
    r'\bear\s*drops?\b|\botic\b': 'Otic',
    r'\bsublingual\b|\bsl\b|\bunder\s+tongue\b': 'Sublingual',
    r'\brectal\b|\bsuppository\b|\bpr\b': 'Rectal',
}


class MedicalNLPEngine:
    def __init__(self):
        self._nlp = None
        self._load_spacy()

    def _load_spacy(self):
        """Load spaCy model with fallback."""
        try:
            self._nlp = spacy.load("en_core_web_md")
            logger.info("Loaded spaCy en_core_web_md model")
        except OSError:
            try:
                self._nlp = spacy.load("en_core_web_sm")
                logger.info("Loaded spaCy en_core_web_sm model (fallback)")
            except OSError:
                logger.warning("No spaCy model found. NLP features limited.")
                self._nlp = None

    def extract_medicines(self, text: str) -> List[Dict]:
        """
        Extract structured medicine information from prescription text.
        Uses multi-strategy approach: regex + NLP + fuzzy matching.
        """
        text_lower = text.lower()
        lines = text.split('\n')
        medicines = []
        seen_names = set()

        for line in lines:
            line = line.strip()
            if not line or len(line) < 3:
                continue

            medicine = self._extract_medicine_from_line(line, text_lower)
            if medicine and medicine['name'].lower() not in seen_names:
                seen_names.add(medicine['name'].lower())
                medicines.append(medicine)

        # Fuzzy match against known medicine database
        medicines = self._enhance_with_fuzzy_matching(medicines, text_lower)

        return medicines

    def _extract_medicine_from_line(self, line: str, full_text: str) -> Optional[Dict]:
        """Extract a single medicine entry from a text line."""
        line_lower = line.lower()

        # Skip lines that are clearly not medicine entries
        skip_patterns = [
            r'^(date|patient|dr\.?|doctor|name|age|sex|hospital|clinic|signature)',
            r'^(rx|℞|prescription|diagnosis|assessment|plan)',
            r'^\d+\.',  # Numbered diagnosis list
        ]
        for pat in skip_patterns:
            if re.match(pat, line_lower):
                return None

        # Try to match known medicine names via fuzzy matching
        medicine_name = self._find_medicine_name(line_lower)
        if not medicine_name:
            return None

        medicine = {
            'name': medicine_name,
            'generic_name': None,
            'dosage': self._extract_dosage(line),
            'frequency': self._extract_frequency(line),
            'duration': self._extract_duration(line),
            'quantity': self._extract_quantity(line),
            'route': self._extract_route(line),
            'instructions': self._extract_instructions(line),
            'confidence': self._calculate_confidence(line, medicine_name),
        }

        return medicine

    def _find_medicine_name(self, text: str) -> Optional[str]:
        """Find medicine name using fuzzy matching against database."""
        # Direct match
        for med in MEDICINE_DATABASE:
            if med in text:
                return med.title()

        # Fuzzy match with threshold
        words = text.split()
        for i in range(len(words)):
            for j in range(i + 1, min(i + 4, len(words) + 1)):
                phrase = ' '.join(words[i:j])
                if len(phrase) < 4:
                    continue
                match, score = process.extractOne(
                    phrase, MEDICINE_DATABASE, scorer=fuzz.ratio
                )
                if score >= 80:
                    return match.title()

        return None

    def _extract_dosage(self, text: str) -> Optional[str]:
        """Extract dosage from text."""
        for pattern in DOSAGE_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(0).strip()
        return None

    def _extract_frequency(self, text: str) -> Optional[str]:
        """Extract dosage frequency."""
        text_lower = text.lower()
        for pattern, label in FREQUENCY_MAP.items():
            if re.search(pattern, text_lower, re.IGNORECASE):
                return label
        return None

    def _extract_duration(self, text: str) -> Optional[str]:
        """Extract treatment duration."""
        for pattern in DURATION_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                groups = match.groups()
                return f"{groups[0]} {groups[1]}"
        return None

    def _extract_quantity(self, text: str) -> Optional[int]:
        """Extract quantity of medicine."""
        patterns = [
            r'qty[:\s]*(\d+)',
            r'quantity[:\s]*(\d+)',
            r'#\s*(\d+)',
            r'(\d+)\s*tablets?',
            r'(\d+)\s*capsules?',
            r'(\d+)\s*vials?',
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return int(match.group(1))
        return None

    def _extract_route(self, text: str) -> Optional[str]:
        """Extract administration route."""
        for pattern, route in ROUTE_PATTERNS.items():
            if re.search(pattern, text, re.IGNORECASE):
                return route
        return "Oral"  # Default for most prescriptions

    def _extract_instructions(self, text: str) -> Optional[str]:
        """Extract special instructions."""
        instructions = []
        instruction_patterns = [
            (r'after\s+(?:food|meal|meals)', 'Take after food'),
            (r'before\s+(?:food|meal|meals)', 'Take before food'),
            (r'with\s+food', 'Take with food'),
            (r'with\s+milk', 'Take with milk'),
            (r'on\s+empty\s+stomach', 'Take on empty stomach'),
            (r'avoid\s+(?:sun|sunlight)', 'Avoid sun exposure'),
            (r'avoid\s+alcohol', 'Avoid alcohol'),
            (r'swallow\s+whole', 'Swallow whole'),
            (r'chew\s+before', 'Chew before swallowing'),
        ]
        for pattern, instruction in instruction_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                instructions.append(instruction)
        return '; '.join(instructions) if instructions else None

    def _calculate_confidence(self, text: str, medicine_name: str) -> float:
        """Calculate confidence score for the extraction."""
        score = 0.5  # Base score for fuzzy match

        # Boost score if dosage found
        if self._extract_dosage(text):
            score += 0.2

        # Boost score if frequency found
        if self._extract_frequency(text):
            score += 0.15

        # Boost score if duration found
        if self._extract_duration(text):
            score += 0.1

        # Boost if exact name in DB
        for med in MEDICINE_DATABASE:
            if med == medicine_name.lower():
                score += 0.1
                break

        return min(score, 1.0)

    def _enhance_with_fuzzy_matching(self, medicines: List[Dict], full_text: str) -> List[Dict]:
        """Second pass: catch missed medicines with looser matching."""
        found_names = {m['name'].lower() for m in medicines}

        # Check for common Sri Lankan medicine abbreviations
        abbreviations = {
            'pcm': 'Paracetamol',
            'ibu': 'Ibuprofen',
            'amox': 'Amoxicillin',
            'metro': 'Metronidazole',
            'augmentin': 'Amoxicillin/Clavulanate',
            'azithro': 'Azithromycin',
        }

        for abbr, full_name in abbreviations.items():
            if abbr in full_text and full_name.lower() not in found_names:
                medicines.append({
                    'name': full_name,
                    'generic_name': None,
                    'dosage': None,
                    'frequency': None,
                    'duration': None,
                    'quantity': None,
                    'route': 'Oral',
                    'instructions': None,
                    'confidence': 0.65,
                })
                found_names.add(full_name.lower())

        return medicines

    def extract_patient_info(self, text: str) -> Dict:
        """Extract patient information from prescription header."""
        info = {}
        patterns = {
            'name': [
                r'patient[\s:]+([A-Za-z\s\.]+?)(?:\n|age|dob|date|$)',
                r'name[\s:]+([A-Za-z\s\.]+?)(?:\n|age|dob|$)',
                r'pt[\s:\.]+([A-Za-z\s\.]+?)(?:\n|age|dob|$)',
            ],
            'age': [
                r'age[\s:]+(\d+\s*(?:years?|yrs?|y\.?o\.?)?)',
                r'(\d+)\s*(?:years?|yrs?)\s+old',
                r'(\d+)\/(?:m|f|male|female)',
            ],
            'gender': [
                r'\b(male|female|m|f)\b',
                r'sex[\s:]+([mf]|male|female)',
                r'gender[\s:]+([mf]|male|female)',
            ],
            'date': [
                r'date[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})',
                r'(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})',
            ],
        }

        for field, field_patterns in patterns.items():
            for pattern in field_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    info[field] = match.group(1).strip()
                    break

        return info

    def extract_doctor_info(self, text: str) -> Dict:
        """Extract prescribing doctor information."""
        info = {}
        patterns = {
            'name': [
                r'dr\.?\s+([A-Za-z\s\.]+?)(?:\n|reg|slmc|$)',
                r'doctor[\s:]+([A-Za-z\s\.]+?)(?:\n|reg|$)',
                r'physician[\s:]+([A-Za-z\s\.]+?)(?:\n|reg|$)',
            ],
            'registration_number': [
                r'slmc[\s#:]+(\d+)',
                r'reg(?:\.|\s+no)?\.?[\s:]+([A-Z0-9\/\-]+)',
                r'registration[\s:]+([A-Z0-9\/\-]+)',
            ],
            'hospital': [
                r'hospital[\s:]+([A-Za-z\s]+?)(?:\n|$)',
                r'clinic[\s:]+([A-Za-z\s]+?)(?:\n|$)',
            ],
        }

        for field, field_patterns in patterns.items():
            for pattern in field_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    info[field] = match.group(1).strip()
                    break

        return info

    def extract_diagnosis(self, text: str) -> Optional[str]:
        """Extract diagnosis information."""
        patterns = [
            r'diagnosis[\s:]+(.+?)(?:\n|medicines?|rx|$)',
            r'dx[\s:]+(.+?)(?:\n|medicines?|rx|$)',
            r'complaint[\s:]+(.+?)(?:\n|$)',
            r'condition[\s:]+(.+?)(?:\n|$)',
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None


# ─── Singleton ───────────────────────────────────────────────────────────────
nlp_engine = MedicalNLPEngine()
