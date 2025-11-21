/**
 * Journal ranking utilities
 * Determines journal quartile (Q1/Q2/Q3/Q4) based on various metrics
 */

/**
 * Get journal ranking from OpenAlex
 * OpenAlex provides impact factor and percentile rankings
 * @param {string} journalName - Name of the journal
 * @returns {Promise<string|null>} Quartile (Q1/Q2/Q3/Q4) or null
 */
async function getJournalRankingFromOpenAlex(journalName) {
    try {
        const encodedName = encodeURIComponent(journalName);
        const url = `https://api.openalex.org/sources?search=${encodedName}&per-page=1`;

        console.log('Searching OpenAlex for journal ranking:', journalName);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'ReferenceHub (mailto:research@example.com)'
            }
        });

        if (!response.ok) {
            console.warn('OpenAlex journal search error:', response.status);
            return null;
        }

        const data = await response.json();

        if (data.results?.length > 0) {
            const journal = data.results[0];
            console.log('Found journal in OpenAlex:', journal);

            // OpenAlex provides summary stats with percentiles
            const summaryStats = journal.summary_stats;

            // Check if we have citation metrics
            if (summaryStats) {
                // Get the 2-year mean citedness (similar to impact factor)
                const citedness = summaryStats['2yr_mean_citedness'];

                // Get works count to ensure it's a significant journal
                const worksCount = journal.works_count;

                if (citedness !== undefined && worksCount > 100) {
                    // Determine quartile based on citedness
                    // These thresholds are approximate and based on general academic standards
                    if (citedness >= 3.0) return 'Q1';
                    if (citedness >= 1.5) return 'Q2';
                    if (citedness >= 0.5) return 'Q3';
                    return 'Q4';
                }
            }

            // Alternative: Use h-index if available
            const hIndex = journal.summary_stats?.h_index;
            if (hIndex !== undefined) {
                if (hIndex >= 100) return 'Q1';
                if (hIndex >= 50) return 'Q2';
                if (hIndex >= 20) return 'Q3';
                return 'Q4';
            }
        }

        return null;
    } catch (error) {
        console.error('Error fetching journal ranking from OpenAlex:', error);
        return null;
    }
}

/**
 * Get journal ranking from Scimago via web scraping alternative
 * Note: This uses a heuristic approach based on journal name patterns
 * @param {string} journalName - Name of the journal
 * @returns {string|null} Quartile (Q1/Q2/Q3/Q4) or null
 */
function getJournalRankingHeuristic(journalName) {
    const name = journalName.toLowerCase();

    // High-impact journals (Q1)
    const q1Patterns = [
        'nature', 'science', 'cell', 'lancet', 'jama',
        'new england journal', 'pnas', 'proceedings of the national academy',
        'annual review', 'ieee transactions on pattern analysis',
        'acm computing surveys', 'journal of machine learning research',
        'communications of the acm', 'artificial intelligence'
    ];

    // Good journals (Q2)
    const q2Patterns = [
        'ieee transactions', 'acm transactions',
        'international journal', 'journal of',
        'european journal', 'american journal'
    ];

    // Check Q1 patterns
    for (const pattern of q1Patterns) {
        if (name.includes(pattern)) {
            console.log(`Matched Q1 pattern: ${pattern}`);
            return 'Q1';
        }
    }

    // Check Q2 patterns (only if not Q1)
    for (const pattern of q2Patterns) {
        if (name.includes(pattern)) {
            console.log(`Matched Q2 pattern: ${pattern}`);
            return 'Q2';
        }
    }

    return null;
}

/**
 * Known journal rankings database (curated list of top journals)
 * This is a small sample - in production, this would be a comprehensive database
 */
const KNOWN_JOURNAL_RANKINGS = {
    // Computer Science & AI
    'nature': 'Q1',
    'science': 'Q1',
    'nature machine intelligence': 'Q1',
    'nature communications': 'Q1',
    'journal of machine learning research': 'Q1',
    'ieee transactions on pattern analysis and machine intelligence': 'Q1',
    'international journal of computer vision': 'Q1',
    'artificial intelligence': 'Q1',
    'neural computation': 'Q1',
    'acm computing surveys': 'Q1',
    'ieee transactions on neural networks and learning systems': 'Q1',
    'neural networks': 'Q1',
    'machine learning': 'Q1',

    // Medicine
    'the lancet': 'Q1',
    'new england journal of medicine': 'Q1',
    'jama': 'Q1',
    'british medical journal': 'Q1',
    'plos medicine': 'Q1',

    // General Science
    'proceedings of the national academy of sciences': 'Q1',
    'scientific reports': 'Q2',
    'plos one': 'Q2',

    // Engineering
    'ieee access': 'Q2',
    'sensors': 'Q2',
    'applied sciences': 'Q3',

    // Add more as needed
};

/**
 * Normalize journal name for matching
 * @param {string} name - Journal name
 * @returns {string} Normalized name
 */
function normalizeJournalName(name) {
    return name
        .toLowerCase()
        .replace(/^the\s+/, '') // Remove leading "The"
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
}

/**
 * Get journal ranking from known database
 * @param {string} journalName - Name of the journal
 * @returns {string|null} Quartile (Q1/Q2/Q3/Q4) or null
 */
function getJournalRankingFromDatabase(journalName) {
    const normalized = normalizeJournalName(journalName);

    // Exact match
    if (KNOWN_JOURNAL_RANKINGS[normalized]) {
        console.log(`Found exact match in database: ${normalized} -> ${KNOWN_JOURNAL_RANKINGS[normalized]}`);
        return KNOWN_JOURNAL_RANKINGS[normalized];
    }

    // Partial match
    for (const [knownJournal, ranking] of Object.entries(KNOWN_JOURNAL_RANKINGS)) {
        if (normalized.includes(knownJournal) || knownJournal.includes(normalized)) {
            console.log(`Found partial match in database: ${knownJournal} -> ${ranking}`);
            return ranking;
        }
    }

    return null;
}

/**
 * Get journal quartile ranking
 * Tries multiple sources: known database -> OpenAlex -> heuristics
 * @param {string} journalName - Name of the journal
 * @returns {Promise<string|null>} Quartile (Q1/Q2/Q3/Q4) or null
 */
export async function getJournalRanking(journalName) {
    if (!journalName || journalName.trim().length < 3) {
        return null;
    }

    console.log('Getting journal ranking for:', journalName);

    // Try known database first (fastest)
    const dbRanking = getJournalRankingFromDatabase(journalName);
    if (dbRanking) {
        console.log('Found ranking in database:', dbRanking);
        return dbRanking;
    }

    // Try OpenAlex (most accurate)
    const openAlexRanking = await getJournalRankingFromOpenAlex(journalName);
    if (openAlexRanking) {
        console.log('Found ranking from OpenAlex:', openAlexRanking);
        return openAlexRanking;
    }

    // Try heuristics (fallback)
    const heuristicRanking = getJournalRankingHeuristic(journalName);
    if (heuristicRanking) {
        console.log('Found ranking from heuristics:', heuristicRanking);
        return heuristicRanking;
    }

    console.log('No ranking found for journal:', journalName);
    return null;
}

/**
 * Get journal ranking tag
 * Returns a formatted tag string for display
 * @param {string} journalName - Name of the journal
 * @returns {Promise<string|null>} Tag string (e.g., "Q1 Journal") or null
 */
export async function getJournalRankingTag(journalName) {
    const ranking = await getJournalRanking(journalName);
    return ranking ? `${ranking} Journal` : null;
}
