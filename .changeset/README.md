# Changesets

Bu dizin [Changesets](https://github.com/changesets/changesets) tarafından kullanılır.

## Yayın akışı

1. **PR'ına changeset ekle:** `npx changeset` → bump türü seç (patch/minor/major) → `.changeset/*.md` commit'lenir.
2. **PR'ı merge et:** `release.yml` çalışır → Changesets bot "Version Packages" PR'ını açar/günceller.
3. **Version PR'ını merge et:** `CHANGELOG.md` güncellenir, npm'e yayınlanır, git tag + GitHub Release otomatik oluşur.

Changeset'siz merge → yayın olmaz, sadece bekler. İdempotent ve güvenli.
