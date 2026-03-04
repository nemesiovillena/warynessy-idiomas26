import React, { useEffect, useState, useMemo } from 'react'
import { useField, useConfig, FieldLabel, useDocumentInfo } from '@payloadcms/ui'

// Caché global para persistir las opciones entre navegaciones client-side de Next.js
// Esto evita que el checklist desaparezca mientras se carga el API al navegar
let globalOptionsCache: { [key: string]: any[] } = {}
let globalInFlightRequests: { [key: string]: Promise<any[]> } = {}

const ChecklistRelationshipInternal: React.FC<any> = (props) => {
    const { path, label, admin } = props
    const fieldObj = props.field || {}
    const fieldRelationTo = props.relationTo || fieldObj.relationTo || 'alergenos'
    const relationTo = useMemo(() => Array.isArray(fieldRelationTo) ? fieldRelationTo[0] : fieldRelationTo, [fieldRelationTo])

    const { value, setValue } = useField<string[] | { id: string }[]>({ path })
    const [options, setOptions] = useState<{ id: string; nombre: string }[]>(globalOptionsCache[relationTo] || [])
    const [isLoading, setIsLoading] = useState(!globalOptionsCache[relationTo])
    const { config } = useConfig()

    useEffect(() => {
        let isMounted = true;

        const fetchOptions = async () => {
            if (!relationTo || typeof relationTo !== 'string') return

            // Si ya hay una petición en curso para esta colección, esperamos a esa
            if (relationTo in globalInFlightRequests) {
                try {
                    const data = await globalInFlightRequests[relationTo]
                    if (isMounted) {
                        setOptions(data)
                        setIsLoading(false)
                    }
                    return
                } catch (e) { }
            }

            // Si no tenemos nada en caché, mostramos cargando
            if (!globalOptionsCache[relationTo]) {
                setIsLoading(true)
            }

            const fetchPromise = (async () => {
                const origin = typeof window !== 'undefined' ? window.location.origin : ''
                const endpoints = [
                    `${origin}/api/${relationTo}?limit=100&depth=0`,
                    `/api/${relationTo}?limit=100&depth=0`,
                    `${config.serverURL || ''}/api/${relationTo}?limit=100&depth=0`
                ]

                for (const url of endpoints) {
                    try {
                        const response = await fetch(url, {
                            headers: { 'Accept': 'application/json' }
                        })

                        if (response.ok) {
                            const data = await response.json()
                            const sortedDocs = (data.docs || []).sort((a: any, b: any) =>
                                a.nombre?.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
                            )
                            globalOptionsCache[relationTo] = sortedDocs
                            return sortedDocs
                        }
                    } catch (e) { }
                }
                throw new Error('No se pudo cargar desde ningún endpoint')
            })()

            globalInFlightRequests[relationTo] = fetchPromise

            try {
                const sortedDocs = await fetchPromise
                if (isMounted) {
                    setOptions(sortedDocs)
                }
            } catch (error) {
                console.error('[Checklist] Error:', error)
            } finally {
                delete globalInFlightRequests[relationTo]
                if (isMounted) setIsLoading(false)
            }
        }

        fetchOptions()
        return () => { isMounted = false }
    }, [relationTo, config.serverURL])

    const handleChange = (id: string) => {
        const currentItems = value || []
        const currentIds = currentItems.map((val: any) => (typeof val === 'object' ? val.id : val))
        let newIds: string[] = currentIds.includes(id)
            ? currentIds.filter((cid: string) => cid !== id)
            : [...currentIds, id]
        setValue(newIds)
    }

    const selectedIds = useMemo(() =>
        (value || []).map((val: any) => (typeof val === 'object' ? val.id : val)),
        [value])

    return (
        <div className="field-type relationship" style={{
            marginBottom: '25px',
            border: '1px solid var(--theme-elevation-150)',
            padding: '20px',
            borderRadius: '8px',
            backgroundColor: 'var(--theme-elevation-50)'
        }}>
            <div style={{ marginBottom: '15px' }}>
                <FieldLabel label={label as any} />
                {admin?.description && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.6 }}>
                        {typeof admin.description === 'string' ? admin.description : ''}
                    </p>
                )}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '10px',
                maxHeight: '300px',
                overflowY: 'auto',
                padding: '4px'
            }}>
                {isLoading && options.length === 0 && (
                    <p style={{ fontSize: '13px', opacity: 0.6 }}>Cargando alérgenos...</p>
                )}

                {!isLoading && options.length === 0 && (
                    <p style={{ fontSize: '13px', opacity: 0.6 }}>No se encontraron alérgenos.</p>
                )}

                {options.map((opt) => (
                    <label
                        key={opt.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            padding: '8px 12px',
                            background: selectedIds.includes(opt.id) ? 'var(--theme-elevation-200)' : 'var(--theme-elevation-100)',
                            borderRadius: '6px',
                            transition: 'all 0.2s ease',
                            border: selectedIds.includes(opt.id) ? '1px solid var(--theme-primary-500)' : '1px solid transparent'
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={selectedIds.includes(opt.id)}
                            onChange={() => handleChange(opt.id)}
                            style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--theme-primary-500)' }}
                        />
                        <span style={{ fontWeight: selectedIds.includes(opt.id) ? '600' : '400' }}>
                            {opt.nombre}
                        </span>
                    </label>
                ))}
            </div>
        </div>
    )
}

export const ChecklistRelationship: React.FC<any> = (props) => {
    const { id } = useDocumentInfo()

    // El ID del documento cambia al navegar, forzamos un remount completo del componente interno
    // para evitar arrastrar estados de un plato a otro.
    const key = useMemo(() => {
        return `${props.path}-${id || 'new'}`
    }, [props.path, id])

    return <ChecklistRelationshipInternal key={key} {...props} />
}

export default ChecklistRelationship
