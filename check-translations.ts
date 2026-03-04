import { getPayload } from 'payload'
import config from './src/payload/payload.config.ts'

async function checkTranslations() {
    const payload = await getPayload({ config })

    const locales = ['es', 'ca', 'en', 'fr', 'de']

    // Buscar la categoría "Entrantes"
    const baseCat = await payload.find({
        collection: 'categorias',
        where: { nombre: { equals: 'Entrantes' } },
        locale: 'es'
    })

    if (baseCat.docs.length === 0) {
        console.log('No se encontró la categoría "Entrantes". Proporcione un ID válido o cree una.')
        return
    }

    const id = baseCat.docs[0].id
    console.log(`Verificando ID: ${id} (${baseCat.docs[0].nombre})`)

    for (const locale of locales) {
        const doc = await payload.findByID({
            collection: 'categorias',
            id,
            locale: locale as any
        })
        console.log(`Locale [${locale}]: ${doc.nombre}`)
    }
}

checkTranslations().then(() => process.exit(0)).catch(err => {
    console.error(err)
    process.exit(1)
})
