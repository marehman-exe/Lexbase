# query_guard.py — detect off-topic / non-legal queries before hitting the DB.
#
# Strategy: three-pass check
#   1. Off-topic verb+noun patterns — "what is the weather/whether",
#      "who won the match", "tell me a joke", etc.
#   2. Off-topic domain keywords — weather, sports, cooking, etc. — blocked
#      only when no legal-signal word is also present.
#   3. Common typo / phonetic variants of blocked patterns (e.g. "whether"
#      used as "weather", "wether", "wheather").
#
# Returns (is_off_topic: bool, reason: str)

# Regex used for compiling all pattern matchers in this module
import re

# ── Normalise common typos before pattern matching ────────────────────────────
# Map of compiled regex patterns to their corrected replacement strings
_TYPO_MAP = [
    (re.compile(r"\bwhether\b", re.IGNORECASE), "weather"),   # "whether today" -> "weather today"
    (re.compile(r"\bwheather\b", re.IGNORECASE), "weather"),  # "wheather" -> "weather"
    (re.compile(r"\bwether\b",   re.IGNORECASE), "weather"),  # "wether" -> "weather"
    (re.compile(r"\btemprature\b", re.IGNORECASE), "temperature"),
]

# Apply all typo corrections to a query string before pattern matching
def _normalise(q: str) -> str:
    for pattern, replacement in _TYPO_MAP:
        q = pattern.sub(replacement, q)
    return q


# ── 1. Hard-blocked question starters ────────────────────────────────────────
# Regex that matches common non-legal question openers at the start of a query
_OFF_TOPIC_STARTERS = re.compile(
    r"^(what (is|are|was|were|'s) (the )?(weather|temperature|humidity|forecast|"
    r"time|date|score|result|news|price|rate of exchange|exchange rate)|"
    r"how (is|will) (the )?weather|"
    r"who (won|lost|scored|is playing|is the president|is the prime minister|"
    r"is the ceo|sings|wrote the song)|"
    r"how (do i cook|do i make|do i bake|do you make)|"
    r"tell me (a joke|a story|about yourself|your name)|"
    r"what('s| is) (your name|the capital of|the population of|the currency of)|"
    r"(give me|show me|find me) (a recipe|directions to|the weather|news about)|"
    r"(translate|convert) .{1,60} (to|into|from)|"
    r"(play|sing|recommend) (a song|music|a movie|a show))",
    re.IGNORECASE,
)

# ── 2. Off-topic domain words ─────────────────────────────────────────────────
# Regex matching domain-specific words that indicate a non-legal subject area
_OFF_TOPIC_DOMAINS = re.compile(
    r"\b(weather|forecast|temperature|humidity|rainfall|"
    r"cricket|football|soccer|hockey|match score|"
    r"stock price|currency exchange|share price|"
    r"recipe|cooking|baking|restaurant|"
    r"movie|cinema|song|singer|celebrity|"
    r"gossip|horoscope|astrology|zodiac)\b",
    re.IGNORECASE,
)

# ── 3. Legal-signal words — override domain block if present ──────────────────
# Regex matching words that indicate a genuine legal or document-related query
_LEGAL_SIGNALS = re.compile(
    r"\b(law|legal|court|case|section|clause|act|statute|judgment|judgement|"
    r"appeal|petition|plaintiff|defendant|accused|bail|acquittal|conviction|"
    r"sentence|evidence|witness|contract|lease|agreement|notice|termination|"
    r"liability|damages|injunction|writ|habeas|suo motu|constitution|article|"
    r"ordinance|tribunal|magistrate|advocate|counsel|barrister|solicitor|"
    r"firm|document|proceedings|hearing|order|decree|civil|criminal|"
    r"high court|supreme court|district court|session|fir|complaint)\b",
    re.IGNORECASE,
)


# Return whether the query is off-topic for a legal research assistant
def is_off_topic(query: str) -> tuple[bool, str]:
    """
    Returns (True, reason) if the query is clearly off-topic for a legal RAG system.
    Returns (False, "") if the query may be a legitimate legal question.
    """
    q = query.strip()

    # Normalise common typos first so "whether today" == "weather today"
    q_norm = _normalise(q)

    # Pass 1 — hard-blocked starter phrases (run on normalised query)
    if _OFF_TOPIC_STARTERS.match(q_norm):
        return True, "query matches a non-legal question pattern"

    # Pass 2 — off-topic domain words without any legal signal
    if _OFF_TOPIC_DOMAINS.search(q_norm) and not _LEGAL_SIGNALS.search(q_norm):
        return True, "query is about a non-legal domain with no legal context"

    # Query passed all checks and may be a valid legal question
    return False, ""
