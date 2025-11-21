/**
 * Search academic databases for paper metadata using the title
 * Tries multiple sources: CrossRef, OpenAlex, and Semantic Scholar
 * Now fetches ALL available metadata fields
 */

/**
 * Clean abstract text by removing JATS XML tags
 * @param {string} text - Abstract text that may contain XML tags
 * @returns {string} Cleaned abstract text
 */
function cleanAbstract(text) {
    if (!text) return '';

    // Remove all JATS XML tags (e.g., <jats:title>, <jats:p>, etc.)
    let cleaned = text.replace(/<jats:[^>]+>/g, '');
    cleaned = cleaned.replace(/<\/jats:[^>]+>/g, '');

    // Remove any other XML/HTML tags
    cleaned = cleaned.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    cleaned = cleaned.replace(/&lt;/g, '<');
    cleaned = cleaned.replace(/&gt;/g, '>');
    cleaned = cleaned.replace(/&amp;/g, '&');
    cleaned = cleaned.replace(/&quot;/g, '"');
    cleaned = cleaned.replace(/&apos;/g, "'");

    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
}

/**
 * Search CrossRef API for paper metadata
 * @param {string} title - Paper title to search for
 * @returns {Promise<Object|null>} Paper metadata or null
 */
async function searchCrossRef(title) {
    try {
        const encodedTitle = encodeURIComponent(title);
        // Request ALL available fields from CrossRef
        const url = `https://api.crossref.org/works?query.title=${encodedTitle}&rows=1`;

        console.log('Searching CrossRef for:', title);
        const response = await fetch(url);

        if (!response.ok) {
            console.warn('CrossRef API error:', response.status);
            return null;
        }

        const data = await response.json();

        if (data.message?.items?.length > 0) {
            const item = data.message.items[0];
            console.log('CrossRef result (complete):', item);

            return {
                title: item.title?.[0] || '',
                authors: item.author?.map(a => {
                    const given = a.given || '';
                    const family = a.family || '';
                    return family ? `${family}, ${given}`.trim() : given;
                }).filter(Boolean) || [],
                year: item.published?.['date-parts']?.[0]?.[0] || new Date().getFullYear(),
                journal: item['container-title']?.[0] || '',
                abstract: cleanAbstract(item.abstract) || '',
                doi: item.DOI || '',
                type: item.type || 'journal-article',
                volume: item.volume || '',
                issue: item.issue || '',
                pages: item.page || '',
                publisher: item.publisher || '',
                url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : ''),
                issn: item.ISSN?.[0] || '',
                isbn: item.ISBN?.[0] || '',
                language: item.language || '',
                references: item['references-count'] || 0,
                citations: item['is-referenced-by-count'] || 0,
                source: 'CrossRef'
            };
        }

        return null;
    } catch (error) {
        console.error('CrossRef search error:', error);
        return null;
    }
}

/**
 * Search OpenAlex API for paper metadata
 * @param {string} title - Paper title to search for
 * @returns {Promise<Object|null>} Paper metadata or null
 */
async function searchOpenAlex(title) {
    try {
        const encodedTitle = encodeURIComponent(title);
        const url = `https://api.openalex.org/works?search=${encodedTitle}&per-page=1`;

        console.log('Searching OpenAlex for:', title);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'ReferenceHub (mailto:research@example.com)'
            }
        });

        if (!response.ok) {
            console.warn('OpenAlex API error:', response.status);
            return null;
        }

        const data = await response.json();

        if (data.results?.length > 0) {
            const item = data.results[0];
            console.log('OpenAlex result (complete):', item);

            return {
                title: item.title || '',
                authors: item.authorships?.map(a => {
                    const name = a.author?.display_name || '';
                    return name;
                }).filter(Boolean) || [],
                year: item.publication_year || new Date().getFullYear(),
                journal: item.primary_location?.source?.display_name || '',
                abstract: item.abstract_inverted_index ? cleanAbstract(reconstructAbstract(item.abstract_inverted_index)) : '',
                doi: item.doi?.replace('https://doi.org/', '') || '',
                type: item.type || 'article',
                volume: item.biblio?.volume || '',
                issue: item.biblio?.issue || '',
                pages: item.biblio?.first_page && item.biblio?.last_page
                    ? `${item.biblio.first_page}-${item.biblio.last_page}`
                    : (item.biblio?.first_page || ''),
                publisher: item.primary_location?.source?.host_organization_name || '',
                url: item.doi || item.primary_location?.landing_page_url || '',
                issn: item.primary_location?.source?.issn_l || '',
                language: item.language || '',
                references: item.referenced_works_count || 0,
                citations: item.cited_by_count || 0,
                source: 'OpenAlex'
            };
        }

        return null;
    } catch (error) {
        console.error('OpenAlex search error:', error);
        return null;
    }
}

/**
 * Search Semantic Scholar API for paper metadata
 * @param {string} title - Paper title to search for
 * @returns {Promise<Object|null>} Paper metadata or null
 */
async function searchSemanticScholar(title) {
    try {
        const encodedTitle = encodeURIComponent(title);
        const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodedTitle}&limit=1&fields=title,authors,year,venue,abstract,externalIds,publicationTypes,publicationVenue,citationCount,referenceCount,url`;

        console.log('Searching Semantic Scholar for:', title);
        const response = await fetch(url);

        if (!response.ok) {
            console.warn('Semantic Scholar API error:', response.status);
            return null;
        }

        const data = await response.json();

        if (data.data?.length > 0) {
            const item = data.data[0];
            console.log('Semantic Scholar result (complete):', item);

            return {
                title: item.title || '',
                authors: item.authors?.map(a => a.name).filter(Boolean) || [],
                year: item.year || new Date().getFullYear(),
                journal: item.publicationVenue?.name || item.venue || '',
                abstract: cleanAbstract(item.abstract) || '',
                doi: item.externalIds?.DOI || '',
                type: item.publicationTypes?.[0] || 'article',
                volume: '',
                issue: '',
                pages: '',
                publisher: item.publicationVenue?.publisher || '',
                url: item.url || (item.externalIds?.DOI ? `https://doi.org/${item.externalIds.DOI}` : ''),
                issn: item.publicationVenue?.issn || '',
                language: '',
                references: item.referenceCount || 0,
                citations: item.citationCount || 0,
                source: 'Semantic Scholar'
            };
        }

        return null;
    } catch (error) {
        console.error('Semantic Scholar search error:', error);
        return null;
    }
}

/**
 * Reconstruct abstract from OpenAlex inverted index format
 * @param {Object} invertedIndex - Inverted index object
 * @returns {string} Reconstructed abstract
 */
function reconstructAbstract(invertedIndex) {
    try {
        const words = [];
        for (const [word, positions] of Object.entries(invertedIndex)) {
            for (const pos of positions) {
                words[pos] = word;
            }
        }
        return words.filter(Boolean).join(' ').slice(0, 1000);
    } catch (error) {
        console.error('Error reconstructing abstract:', error);
        return '';
    }
}

/**
 * Search multiple academic databases for paper metadata
 * Tries CrossRef first, then OpenAlex, then Semantic Scholar
 * @param {string} title - Paper title to search for
 * @returns {Promise<Object|null>} Paper metadata or null
 */
export async function searchAcademicDatabases(title) {
    if (!title || title.trim().length < 10) {
        console.warn('Title too short for academic search:', title);
        return null;
    }

    console.log('Starting academic database search for:', title);

    // Try CrossRef first (most comprehensive for DOIs and bibliographic data)
    let result = await searchCrossRef(title);
    if (result) {
        console.log('Found result from CrossRef');
        return result;
    }

    // Try OpenAlex second (good coverage, includes abstracts and citation counts)
    result = await searchOpenAlex(title);
    if (result) {
        console.log('Found result from OpenAlex');
        return result;
    }

    // Try Semantic Scholar last (good for CS papers)
    result = await searchSemanticScholar(title);
    if (result) {
        console.log('Found result from Semantic Scholar');
        return result;
    }

    console.log('No results found in any academic database');
    return null;
}

/**
 * Map publication type to reference type
 * @param {string} type - Publication type from API
 * @returns {string} Reference type
 */
export function mapPublicationType(type) {
    const typeMap = {
        'journal-article': 'Journal Article',
        'article': 'Journal Article',
        'proceedings-article': 'Conference Paper',
        'book-chapter': 'Book Chapter',
        'dissertation': 'Thesis',
        'report': 'Technical Report',
        'posted-content': 'Preprint',
        'preprint': 'Preprint'
    };

    return typeMap[type?.toLowerCase()] || 'Journal Article';
}
