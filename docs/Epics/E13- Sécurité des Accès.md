# E-Security — Sécurité des Accès

**Phase** : P2
**Dépendances** : E01 (Auth & Comptes)
**Contexte** : Fonctionnalités de sécurité avancées destinées principalement aux comptes corporate (ayants droits, exploitants avec équipes). Déplacé depuis E01-003 pour ne pas bloquer les autres epics.

---

## Tickets

### SEC-001 — Activation MFA (TOTP) depuis le profil
**Priorité** : P2 | **Taille** : M

Le plugin `twoFactor` Better Auth est déjà configuré côté serveur et client. Le flow de login gère déjà la saisie du code TOTP. Il reste à construire l'UI d'activation/désactivation.

- ⬜ Page/section dans le profil utilisateur (`/account/profile`) pour activer le MFA
- ⬜ Flow d'activation : générer le secret TOTP, afficher le QR code, demander confirmation avec un code valide
- ⬜ Bouton de désactivation (avec confirmation par mot de passe)
- ⬜ Traductions en/fr

### SEC-002 — Codes de récupération MFA
**Priorité** : P2 | **Taille** : S

- ⬜ Génération de codes de récupération à l'activation du MFA (backup codes)
- ⬜ Affichage unique des codes (avec download/copie)
- ⬜ Flow de login avec code de récupération en alternative au TOTP
- ⬜ Régénération des codes (invalidation des anciens)

### SEC-003 — MFA forcé pour les admins
**Priorité** : P3 | **Taille** : S

- ⬜ Option pour forcer le MFA pour tous les comptes admin
- ⬜ Redirection vers l'activation MFA au login si non activé et forcé
- ⬜ Configuration dans le backoffice admin

### SEC-004 — Politique de mots de passe renforcée
**Priorité** : P3 | **Taille** : S

- ⬜ Configurer les règles de complexité minimale (longueur, caractères spéciaux)
- ⬜ Vérification côté serveur dans Better Auth
- ⬜ Indicateur de force du mot de passe dans les formulaires

### SEC-005 — Audit log des connexions
**Priorité** : P3 | **Taille** : M

- ⬜ Historique des connexions (date, IP, device, succès/échec)
- ⬜ Notification email en cas de connexion depuis un nouveau device
- ⬜ Page d'historique accessible depuis le profil

---

## Notes

- Le plugin `twoFactor` de Better Auth est déjà importé et configuré dans `src/lib/auth/index.ts` (issuer: "TIMELESS").
- Le client auth inclut déjà `twoFactorClient()` dans `src/lib/auth/client.ts`.
- La page de login gère déjà la saisie du code TOTP (E01-003 base).
- L'invalidation des sessions après reset password est déjà implémentée (E01-004 — `revokeSessionsOnPasswordReset: true`).
