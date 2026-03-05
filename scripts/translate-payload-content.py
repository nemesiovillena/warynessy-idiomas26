#!/usr/bin/env python3
"""
Script de traducción masiva de contenido de Payload CMS.
Lee datos en español, traduce a ca/en/fr/de via agente de traducción,
y hace PATCH a Payload para cada doc/global.

Uso: python3 scripts/translate-payload-content.py
"""

import requests
import time
import sys
from typing import Optional

# Force stdout flush for real-time output
sys.stdout.reconfigure(line_buffering=True)

PAYLOAD_URL = "http://localhost:3000/api"
TRANSLATION_URL = "http://localhost:8000/translate"
TARGET_LANGS = ["ca", "en", "fr", "de"]
PAYLOAD_EMAIL = "info@warynessy.com"
PAYLOAD_PASSWORD = "W965801047n"

# Colecciones con sus campos localizados traducibles (texto libre)
COLLECTIONS = {
    "alergenos": ["nombre", "descripcion"],
    "menus": ["nombre", "descripcion_menu", "etiqueta", "fechasDias"],
    "categorias": ["nombre", "descripcion"],
    "platos": ["nombre", "descripcion"],
    "espacios": ["nombre", "descripcion"],
    "menus-grupo": ["nombre", "descripcion"],
}

# Globals con sus campos localizados traducibles
GLOBALS = {
    "pagina-inicio": [
        "heroTitle", "heroSubtitle", "welcomeTitle", "welcomeText",
        "ctaTitle", "ctaText", "ctaButtonText", "seoTitle", "seoDescription"
    ],
}

def get_auth_token() -> Optional[str]:
    """Login a Payload y devuelve el JWT token."""
    resp = requests.post(
        f"{PAYLOAD_URL}/usuarios/login",
        json={"email": PAYLOAD_EMAIL, "password": PAYLOAD_PASSWORD},
        headers={"Content-Type": "application/json"},
        timeout=10
    )
    if resp.status_code == 200:
        return resp.json().get("token")
    print(f"❌ Login fallido: {resp.status_code} {resp.text[:100]}")
    return None

def translate(text: str, target_lang: str) -> Optional[str]:
    """Traduce texto via agente de traducción."""
    if not text or not text.strip():
        return None
    try:
        resp = requests.post(
            TRANSLATION_URL,
            json={"text": text, "target_lang": target_lang},
            timeout=30
        )
        if resp.status_code == 200:
            return resp.json().get("translated_text")
        else:
            print(f"  ⚠️  Error traducción ({resp.status_code}): {resp.text[:100]}")
            return None
    except Exception as e:
        print(f"  ❌ Error agente traducción: {e}")
        return None

def get_collection_docs(collection: str) -> list:
    """Fetch todos los docs de una colección en español."""
    docs = []
    page = 1
    while True:
        resp = requests.get(
            f"{PAYLOAD_URL}/{collection}",
            params={"locale": "es", "limit": 100, "page": page, "depth": 0},
            timeout=15
        )
        if resp.status_code != 200:
            print(f"  ⚠️  Error fetch {collection}: {resp.status_code}")
            break
        data = resp.json()
        docs.extend(data.get("docs", []))
        if not data.get("hasNextPage"):
            break
        page += 1
    return docs

def patch_collection_doc(collection: str, doc_id: int, fields: dict, locale: str, token: str) -> bool:
    """PATCH un doc de colección con los campos traducidos."""
    resp = requests.patch(
        f"{PAYLOAD_URL}/{collection}/{doc_id}",
        params={"locale": locale},
        json=fields,
        headers={"Content-Type": "application/json", "Authorization": f"JWT {token}"},
        timeout=15
    )
    return resp.status_code in (200, 201)

def get_global(global_slug: str) -> dict:
    """Fetch un global en español."""
    resp = requests.get(
        f"{PAYLOAD_URL}/globals/{global_slug}",
        params={"locale": "es", "depth": 0},
        timeout=15
    )
    if resp.status_code == 200:
        return resp.json()
    return {}

def patch_global(global_slug: str, fields: dict, locale: str, token: str) -> bool:
    """PATCH un global con los campos traducidos."""
    resp = requests.post(
        f"{PAYLOAD_URL}/globals/{global_slug}",
        params={"locale": locale},
        json=fields,
        headers={"Content-Type": "application/json", "Authorization": f"JWT {token}"},
        timeout=15
    )
    return resp.status_code in (200, 201)

def translate_collection(collection: str, fields: list, token: str):
    """Traduce todos los docs de una colección."""
    print(f"\n📚 Colección: {collection}")
    docs = get_collection_docs(collection)
    print(f"   {len(docs)} documentos encontrados")

    for doc in docs:
        doc_id = doc.get("id")
        fields_es = {f: doc.get(f) for f in fields if doc.get(f)}
        if not fields_es:
            print(f"   ⏭️  Doc {doc_id}: sin campos para traducir")
            continue

        name_preview = list(fields_es.values())[0][:40] if fields_es else "?"
        print(f"   📝 Doc {doc_id}: {name_preview}")

        for lang in TARGET_LANGS:
            translated = {}
            for field, value in fields_es.items():
                result = translate(value, lang)
                if result:
                    translated[field] = result
                time.sleep(0.3)

            if translated:
                ok = patch_collection_doc(collection, doc_id, translated, lang, token)
                status = "✓" if ok else "✗"
                print(f"      [{lang}] {status} {list(translated.keys())}")
            else:
                print(f"      [{lang}] ⏭️  sin traducciones")

def translate_global(global_slug: str, fields: list, token: str):
    """Traduce un global."""
    print(f"\n🌐 Global: {global_slug}")
    doc = get_global(global_slug)
    fields_es = {f: doc.get(f) for f in fields if doc.get(f)}

    if not fields_es:
        print("   ⏭️  Sin campos para traducir")
        return

    print(f"   {len(fields_es)} campos con contenido")

    for lang in TARGET_LANGS:
        translated = {}
        for field, value in fields_es.items():
            result = translate(value, lang)
            if result:
                translated[field] = result
            time.sleep(0.3)

        if translated:
            ok = patch_global(global_slug, translated, lang, token)
            status = "✓" if ok else "✗"
            print(f"   [{lang}] {status} {list(translated.keys())}")

def main():
    print("🌍 Iniciando traducción masiva de Payload CMS")
    print(f"   Idiomas destino: {TARGET_LANGS}")
    print(f"   Agente de traducción: {TRANSLATION_URL}")

    # Verificar agente
    try:
        r = requests.get(TRANSLATION_URL.replace("/translate", "/"), timeout=5)
        if r.status_code != 200:
            print("❌ Agente de traducción no disponible")
            sys.exit(1)
        print("   ✓ Agente de traducción OK")
    except Exception:
        print("❌ No se puede conectar al agente de traducción en localhost:8000")
        sys.exit(1)

    # Verificar Payload
    try:
        r = requests.get(f"{PAYLOAD_URL}/menus?limit=1", timeout=5)
        if r.status_code != 200:
            print("❌ Payload no disponible")
            sys.exit(1)
        print("   ✓ Payload OK")
    except Exception:
        print("❌ No se puede conectar a Payload en localhost:3000")
        sys.exit(1)

    # Login para obtener token JWT
    print("\n🔑 Autenticando en Payload...")
    token = get_auth_token()
    if not token:
        print("❌ No se pudo autenticar. Abortando.")
        sys.exit(1)
    print("   ✓ Token obtenido")

    # Traducir colecciones
    for collection, fields in COLLECTIONS.items():
        translate_collection(collection, fields, token)

    # Traducir globals
    for global_slug, fields in GLOBALS.items():
        translate_global(global_slug, fields, token)

    print("\n✅ Traducción masiva completada")

if __name__ == "__main__":
    main()
