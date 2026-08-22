# Marketplace Page

The homepage repository owns presentation for `/marketplace/`. It fetches the
generated discovery feed from:

`https://raw.githubusercontent.com/cordisx/marketplace/main/marketplace.json`

The page validates the supported feed version, deduplicates by canonical
`(source, id)`, renders contributed strings only through text nodes, supports
client-side search, and links to plugin source/homepage URLs. Network, JSON,
version, and shape failures produce an explicit error state.

The page does not copy catalog entries into this repository and does not expose
install, update, trust, signature, or safety claims. Catalog contribution links
go back to `cordisx/marketplace`.
