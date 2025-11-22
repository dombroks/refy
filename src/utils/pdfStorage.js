// Utility functions for storing and retrieving PDF files using IndexedDB

const DB_NAME = 'ReferenceManagerDB';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';

// Initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

// Save PDF file to IndexedDB
export async function savePDF(id, file) {
    try {
        const db = await initDB();
        const arrayBuffer = await file.arrayBuffer();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const pdfData = {
                id: id,
                name: file.name,
                type: file.type,
                data: arrayBuffer,
                size: file.size
            };

            const request = store.put(pdfData);

            request.onsuccess = () => resolve(id);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error saving PDF:', error);
        throw error;
    }
}

// Get PDF file from IndexedDB and create a blob URL
export async function getPDFUrl(id) {
    try {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    const blob = new Blob([result.data], { type: result.type });
                    const url = URL.createObjectURL(blob);
                    resolve(url);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error retrieving PDF:', error);
        return null;
    }
}

// Delete PDF file from IndexedDB
export async function deletePDF(id) {
    try {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error deleting PDF:', error);
        throw error;
    }
}

// Get PDF blob for download
export async function getPDFBlob(id) {
    try {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    const blob = new Blob([result.data], { type: result.type });
                    resolve({ blob, name: result.name });
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error retrieving PDF blob:', error);
        return null;
    }
}
