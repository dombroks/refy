import * as pdfjsLib from 'pdfjs-dist';
import { searchAcademicDatabases, mapPublicationType } from './academicSearch';
import { getJournalRankingTag } from './journalRanking';
import { extractDOI as extractDOIFromText } from './doiLookup';

// Configure PDF.js worker to use local worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

/**
 * Extract metadata from a PDF file
 * First extracts title from PDF, then searches academic databases for complete metadata
 * @param {File} file - The PDF file to parse
 * @returns {Promise<Object>} Extracted metadata
 */
export async function extractPDFMetadata(file) {
    console.log('Starting PDF metadata extraction for:', file.name);

    try {
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        console.log('File read successfully, size:', arrayBuffer.byteLength);

        // Load PDF document
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        console.log('PDF loaded, pages:', pdf.numPages);

        // Get PDF metadata
        const metadata = await pdf.getMetadata();
        console.log('PDF metadata:', metadata.info);

        // Extract text from first few pages (title and abstract usually on first pages)
        let fullText = '';
        const maxPages = Math.min(3, pdf.numPages); // Only read first 3 pages

        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }

        console.log('Extracted text length:', fullText.length);

        // Extract basic information using heuristics (as fallback)
        const pdfExtractedData = {
            title: extractTitle(metadata, fullText),
            authors: extractAuthors(metadata, fullText),
            year: extractYear(metadata, fullText),
            abstract: extractAbstract(fullText),
            doi: extractDOI(fullText),
            journal: extractJournal(fullText)
        };

        console.log('PDF-extracted metadata:', pdfExtractedData);

        // If we have a title, search academic databases for more accurate metadata
        if (pdfExtractedData.title && pdfExtractedData.title.length > 10) {
            console.log('Searching academic databases for:', pdfExtractedData.title);
            const academicData = await searchAcademicDatabases(pdfExtractedData.title);

            if (academicData) {
                console.log('Found academic metadata from:', academicData.source);

                // Determine final journal name
                const journalName = academicData.journal || pdfExtractedData.journal;

                // Get journal ranking if we have a journal
                let journalRankingTag = null;
                if (journalName && journalName.trim().length > 0) {
                    console.log('Fetching journal ranking for:', journalName);
                    journalRankingTag = await getJournalRankingTag(journalName);
                    console.log('Journal ranking tag:', journalRankingTag);
                }

                // Merge academic data with PDF data, preferring academic data
                return {
                    title: academicData.title || pdfExtractedData.title,
                    authors: academicData.authors?.length > 0 ? academicData.authors : pdfExtractedData.authors,
                    year: academicData.year || pdfExtractedData.year,
                    abstract: academicData.abstract || pdfExtractedData.abstract,
                    doi: academicData.doi || pdfExtractedData.doi,
                    journal: journalName,
                    type: mapPublicationType(academicData.type),
                    source: academicData.source,
                    journalRanking: journalRankingTag // Add journal ranking
                };
            }
        }

        // Return PDF-extracted data if no academic data found
        console.log('Using PDF-extracted metadata (no academic database match)');
        return pdfExtractedData;
    } catch (error) {
        console.error('Error extracting PDF metadata:', error);
        console.error('Error stack:', error.stack);
        return {
            title: '',
            authors: [],
            year: new Date().getFullYear(),
            abstract: '',
            doi: '',
            journal: ''
        };
    }
}

/**
 * Extract title from PDF metadata or text
 */
function extractTitle(metadata, text) {
    // Try metadata first
    if (metadata?.info?.Title && metadata.info.Title.trim()) {
        return metadata.info.Title.trim();
    }

    // Heuristic: Title is usually the first large block of text
    const lines = text.split('\n').filter(line => line.trim().length > 10);
    if (lines.length > 0) {
        // Get first substantial line (likely the title)
        const titleCandidate = lines[0].trim();
        // Remove common artifacts
        return titleCandidate
            .replace(/^\d+\s*/, '') // Remove leading numbers
            .replace(/\s+/g, ' ') // Normalize whitespace
            .slice(0, 300); // Limit length
    }

    return '';
}

/**
 * Extract authors from PDF metadata or text
 */
function extractAuthors(metadata, text) {
    // Try metadata first
    if (metadata?.info?.Author && metadata.info.Author.trim()) {
        const authorStr = metadata.info.Author.trim();
        return authorStr.split(/[,;]/).map(a => a.trim()).filter(Boolean);
    }

    // Heuristic: Look for author patterns in first page
    const authorPatterns = [
        /(?:by|authors?:)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+(?:\s*,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)*)/i,
        /([A-Z][a-z]+\s+[A-Z]\.\s+[A-Z][a-z]+(?:\s*,\s*[A-Z][a-z]+\s+[A-Z]\.\s+[A-Z][a-z]+)*)/
    ];

    for (const pattern of authorPatterns) {
        const match = text.match(pattern);
        if (match) {
            return match[1].split(',').map(a => a.trim()).filter(Boolean);
        }
    }

    return [];
}

/**
 * Extract publication year
 */
function extractYear(metadata, text) {
    // Try metadata creation date
    if (metadata?.info?.CreationDate) {
        const dateMatch = metadata.info.CreationDate.match(/(\d{4})/);
        if (dateMatch) {
            const year = parseInt(dateMatch[1]);
            if (year >= 1900 && year <= new Date().getFullYear() + 1) {
                return year;
            }
        }
    }

    // Look for year in text (4-digit number between 1900 and current year + 1)
    const currentYear = new Date().getFullYear();
    const yearPattern = /\b(19\d{2}|20[0-2]\d)\b/g;
    const years = text.match(yearPattern);

    if (years) {
        // Find most recent reasonable year
        const validYears = years
            .map(y => parseInt(y))
            .filter(y => y >= 1900 && y <= currentYear + 1)
            .sort((a, b) => b - a);

        if (validYears.length > 0) {
            return validYears[0];
        }
    }

    return new Date().getFullYear();
}

/**
 * Extract abstract
 */
function extractAbstract(text) {
    // Look for abstract section
    const abstractPatterns = [
        /abstract[:\s]*(.+?)(?=\n\s*\n|introduction|keywords|1\.|references)/is,
        /summary[:\s]*(.+?)(?=\n\s*\n|introduction|keywords)/is
    ];

    for (const pattern of abstractPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1]
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 1000); // Limit length
        }
    }

    return '';
}

/**
 * Extract DOI
 */
function extractDOI(text) {
    return extractDOIFromText(text) || '';
}

/**
 * Extract journal name
 */
function extractJournal(text) {
    // Common journal patterns
    const journalPatterns = [
        /published in\s+([A-Z][^,\n]+(?:Journal|Review|Magazine|Proceedings))/i,
        /(Journal of [A-Z][^,\n]+)/i,
        /([A-Z][^,\n]+\sJournal)/i
    ];

    for (const pattern of journalPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1].trim().slice(0, 200);
        }
    }

    return '';
}
