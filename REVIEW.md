# Foreign Relations — Build Review

This file exists only to create a reviewable PR. All code is already deployed on `main`.

**Merge this PR to acknowledge the build.** Closing without merging is also fine.

## Links

- **GitHub Pages:** https://ben-gy.github.io/au-relations/ *(redirects to custom domain once DNS is set)*
- **Custom domain:** https://au-relations.benrichardson.dev *(DNS + cert provisioned automatically during the build)*

## DNS

Already done by the pipeline via the Cloudflare API (`benrichardson.dev` zone):

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `au-relations` | `ben-gy.github.io` | DNS only (grey cloud) |

If the cert hasn't been issued yet, trigger it with:
```bash
gh api repos/ben-gy/au-relations/pages -X PUT -f cname=""
sleep 3
gh api repos/ben-gy/au-relations/pages -X PUT -f cname="au-relations.benrichardson.dev"
```
