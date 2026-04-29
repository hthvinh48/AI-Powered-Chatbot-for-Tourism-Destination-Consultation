import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../lib/useI18n'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const compareValues = (a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return a - b
    return String(a ?? '').localeCompare(String(b ?? ''), undefined, {
        sensitivity: 'base',
        numeric: true,
    })
}

const AdminDataTable = ({
    columns = [],
    rows = [],
    rowKey = 'id',
    loading = false,
    error = '',
    emptyText = '',
    defaultPageSize = 10,
    pageSizeOptions = [10, 20, 50],
    manualSort = false,
    sortBy,
    sortDir = 'asc',
    onSortChange,
}) => {
    const { t } = useI18n()
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(defaultPageSize)
    const [innerSort, setInnerSort] = useState({ by: null, dir: 'asc' })
    const [columnWidths, setColumnWidths] = useState({})
    const resizeRef = useRef(null)
    const resolvedEmptyText = emptyText || t('admin.no_data')

    const activeSortBy = onSortChange ? sortBy : innerSort.by
    const activeSortDir = onSortChange ? sortDir : innerSort.dir

    const sortedRows = useMemo(() => {
        if (manualSort || !activeSortBy) return rows
        const col = columns.find((c) => c.key === activeSortBy)
        if (!col) return rows
        const next = [...rows].sort((ra, rb) => {
            const va = typeof col.sortValue === 'function' ? col.sortValue(ra) : ra?.[col.key]
            const vb = typeof col.sortValue === 'function' ? col.sortValue(rb) : rb?.[col.key]
            const out = compareValues(va, vb)
            return activeSortDir === 'desc' ? -out : out
        })
        return next
    }, [activeSortBy, activeSortDir, columns, manualSort, rows])

    const total = sortedRows.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const safePage = clamp(page, 1, totalPages)
    const startIdx = total === 0 ? 0 : (safePage - 1) * pageSize + 1
    const endIdx = Math.min(total, safePage * pageSize)

    const pageRows = useMemo(() => {
        const from = (safePage - 1) * pageSize
        return sortedRows.slice(from, from + pageSize)
    }, [pageSize, safePage, sortedRows])

    useEffect(() => {
        if (safePage !== page) setPage(safePage)
    }, [page, safePage])

    useEffect(() => {
        setPage(1)
    }, [rows, pageSize, activeSortBy, activeSortDir])

    useEffect(() => {
        const onMouseMove = (e) => {
            const active = resizeRef.current
            if (!active) return
            const nextWidth = clamp(
                active.startWidth + (e.clientX - active.startX),
                active.minWidth,
                active.maxWidth,
            )
            setColumnWidths((prev) => ({ ...prev, [active.colKey]: nextWidth }))
        }

        const onMouseUp = () => {
            resizeRef.current = null
            document.body.classList.remove('admin-col-resize-active')
        }

        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
        return () => {
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', onMouseUp)
        }
    }, [])

    const startResize = (e, col) => {
        e.preventDefault()
        const current = columnWidths[col.key] ?? col.width ?? 180
        resizeRef.current = {
            colKey: col.key,
            startX: e.clientX,
            startWidth: current,
            minWidth: col.minWidth ?? 110,
            maxWidth: col.maxWidth ?? 700,
        }
        document.body.classList.add('admin-col-resize-active')
    }

    const onHeaderClick = (col) => {
        if (!col.sortable) return
        const nextDir =
            activeSortBy === col.key
                ? activeSortDir === 'asc'
                    ? 'desc'
                    : 'asc'
                : (col.defaultSortDir || 'asc')

        if (onSortChange) {
            onSortChange({ sortBy: col.key, sortDir: nextDir })
            return
        }

        setInnerSort({ by: col.key, dir: nextDir })
    }

    const resolveRowKey = (row, index) => {
        if (typeof rowKey === 'function') return rowKey(row, index)
        return row?.[rowKey] ?? index
    }

    return (
        <div className="admin-table-shell">
            <div className="admin-table-wrap">
                <table className="admin-table admin-table--sticky admin-table--resizable">
                    <colgroup>
                        {columns.map((col) => {
                            const w = columnWidths[col.key] ?? col.width
                            return <col key={col.key} style={w ? { width: `${w}px` } : undefined} />
                        })}
                    </colgroup>
                    <thead>
                        <tr>
                            {columns.map((col) => {
                                const isActiveSort = activeSortBy === col.key
                                return (
                                    <th
                                        key={col.key}
                                        style={col.minWidth ? { minWidth: `${col.minWidth}px` } : undefined}
                                        className={col.sortable ? 'is-sortable' : ''}
                                    >
                                        <button
                                            type="button"
                                            className={`admin-th-button ${col.sortable ? 'admin-th-button--sortable' : ''}`}
                                            onClick={() => onHeaderClick(col)}
                                        >
                                            <span>{col.header}</span>
                                            {col.sortable ? (
                                                <span className={`admin-sort-indicator ${isActiveSort ? 'is-active' : ''}`}>
                                                    <i
                                                        className={`ti ${isActiveSort
                                                                ? activeSortDir === 'asc'
                                                                    ? 'ti-chevron-up'
                                                                    : 'ti-chevron-down'
                                                                : 'ti-arrows-sort'
                                                            }`}
                                                    />
                                                </span>
                                            ) : null}
                                        </button>
                                        {col.resizable !== false ? (
                                            <span className="admin-col-resizer" onMouseDown={(e) => startResize(e, col)} />
                                        ) : null}
                                    </th>
                                )
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length}>
                                    <div className="admin-loading-row">{t('admin.loading')}</div>
                                </td>
                            </tr>
                        ) : null}

                        {!loading && error ? (
                            <tr>
                                <td colSpan={columns.length}>
                                    <div className="admin-inline-error">{error}</div>
                                </td>
                            </tr>
                        ) : null}

                        {!loading && !error && pageRows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length}>
                                    <div className="admin-empty-inline">{resolvedEmptyText}</div>
                                </td>
                            </tr>
                        ) : null}

                        {!loading && !error
                            ? pageRows.map((row, index) => (
                                <tr key={resolveRowKey(row, index)}>
                                    {columns.map((col) => (
                                        <td key={col.key}>
                                            {typeof col.render === 'function' ? col.render(row) : row?.[col.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                            : null}
                    </tbody>
                </table>
            </div>

            <div className="admin-table-footer">
                <div className="admin-table-meta">
                    {total > 0
                        ? `${t('admin.showing')} ${startIdx}-${endIdx} / ${total}`
                        : `${t('admin.showing')} 0 / 0`}
                </div>
                <div className="admin-table-controls">
                    <label className="admin-table-size-label">{t('admin.rows')}</label>
                    <select
                        className="admin-page-size"
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                    >
                        {pageSizeOptions.map((x) => (
                            <option key={x} value={x}>
                                {x}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        className="admin-page-btn"
                        onClick={() => setPage((p) => clamp(p - 1, 1, totalPages))}
                        disabled={safePage <= 1}
                    >
                        <i className="ti ti-chevron-left" />
                    </button>
                    <span className="admin-page-index">
                        {safePage}/{totalPages}
                    </span>
                    <button
                        type="button"
                        className="admin-page-btn"
                        onClick={() => setPage((p) => clamp(p + 1, 1, totalPages))}
                        disabled={safePage >= totalPages}
                    >
                        <i className="ti ti-chevron-right" />
                    </button>
                </div>
            </div>
        </div>
    )
}

export default AdminDataTable
