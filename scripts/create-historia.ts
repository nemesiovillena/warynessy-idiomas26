import { getPayload } from 'payload'
import config from '../payload.config'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

async function createHistoriaPage() {
    const payload = await getPayload({ config })

    console.log('Buscando página historia...')
    const existing = await payload.find({
        collection: 'paginas',
        where: {
            slug: {
                equals: 'historia',
            },
        },
    })

    if (existing.docs.length > 0) {
        console.log('La página historia ya existe.')
        return
    }

    console.log('Creando página historia...')
    await payload.create({
        collection: 'paginas',
        data: {
            tituloInterno: 'Historia',
            slug: 'historia',
            heroTitle: 'Nuestra Historia',
            heroSubtitle: 'Un legado de sabor y tradición en Villena.',
            historiaMision: 'Nuestra misión es preservar el sabor tradicional con un toque de vanguardia.',
            historiaHitos: [
                {
                    titulo: 'Los Inicios',
                    descripcion: 'Comenzamos nuestra andadura con ilusión y pasión por la cocina.',
                }
            ],
            metaTitle: 'Nuestra Historia | Warynessy',
            metaDescription: 'Descubre el origen y la evolución del Restaurante Warynessy.',
        },
    })

    console.log('Página historia creada con éxito.')
}

createHistoriaPage().catch(console.error)
