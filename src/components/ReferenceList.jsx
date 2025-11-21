import './ReferenceList.css'

export default function ReferenceList({
    references,
    selectedReference,
    onSelectReference,
    onToggleFavorite,
    viewMode
}) {
    if (references.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-icon">📚</div>
                <h3>No references found</h3>
                <p>Start building your library by adding your first reference</p>
            </div>
        )
    }

    return (
        <div className={`reference-list ${viewMode}-view`}>
            {references.map(reference => (
                <article
                    key={reference.id}
                    className={`reference-card hover-lift ${selectedReference?.id === reference.id ? 'selected' : ''}`}
                    onClick={() => onSelectReference(reference)}
                >
                    <div className="reference-header">
                        <div className="reference-type-badge badge badge-primary">
                            {reference.type}
                        </div>
                        <button
                            className="favorite-btn"
                            onClick={(e) => {
                                e.stopPropagation()
                                onToggleFavorite(reference.id)
                            }}
                            title={reference.favorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                            {reference.favorite ? '⭐' : '☆'}
                        </button>
                    </div>

                    <h3 className="reference-title">{reference.title}</h3>

                    <div className="reference-authors">
                        {reference.authors.join(', ')}
                    </div>

                    <div className="reference-meta">
                        <span className="reference-year">{reference.year}</span>
                        {reference.journal && (
                            <>
                                <span className="meta-separator">•</span>
                                <span className="reference-journal">{reference.journal}</span>
                            </>
                        )}
                    </div>

                    {reference.abstract && (
                        <p className="reference-abstract">
                            {reference.abstract.length > 150
                                ? `${reference.abstract.substring(0, 150)}...`
                                : reference.abstract}
                        </p>
                    )}

                    {reference.tags && reference.tags.length > 0 && (
                        <div className="reference-tags">
                            {reference.tags.map((tag, index) => (
                                <span key={index} className="tag">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </article>
            ))}
        </div>
    )
}
