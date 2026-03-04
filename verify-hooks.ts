import { getPayload } from 'payload'
import config from './src/payload/payload.config'

async function verifyTranslation() {
    const payload = await getPayload({ config })

    console.log('--- Iniciando Verificación de Traducción ---')

    // Buscar una categoría para actualizar (Entrantes es común)
    const cats = await payload.find({
        collection: 'categorias',
        where: {
            nombre: { equals: 'Entrantes' }
        }
    })

    if (cats.docs.length > 0) {
        const cat = cats.docs[0]
        console.log(`Actualizando categoría: ${cat.nombre} (ID: ${cat.id})`)

        // Actualizar para disparar el hook afterChange
        await payload.update({
            collection: 'categorias',
            id: cat.id,
            data: {
                nombre: 'Entrantes' // Mantener igual pero dispara el hook
            },
            locale: 'es'
        })

        console.log('Actualización enviada. Revisa los logs de la terminal de Payload y el agente de traducción.')
    } else {
        console.log('No se encontró la categoría "Entrantes". Buscando cualquier categoría...')
        const allCats = await payload.find({ collection: 'categorias', limit: 1 })
        if (allCats.docs.length > 0) {
            const cat = allCats.docs[0]
            await payload.update({
                collection: 'categorias',
                id: cat.id,
                data: { nombre: cat.nombre },
                locale: 'es'
            })
            console.log(`Actualizada categoría: ${cat.nombre}`)
        } else {
            console.log('No hay categorías disponibles para probar.')
        }
    }
}

verifyTranslation().then(() => process.exit(0)).catch(err => {
    console.error(err)
    process.exit(1)
})
