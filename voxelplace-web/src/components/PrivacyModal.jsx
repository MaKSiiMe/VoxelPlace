export default function PrivacyModal({ onClose }) {
  return (
    <>
      <div style={s.backdrop} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-title"
        style={s.modal}
      >
        <button style={s.closeBtn} onClick={onClose} aria-label="Fermer">✕</button>

        <h2 id="privacy-title" style={s.title}>Politique de confidentialité</h2>
        <p style={s.updated}>Dernière mise à jour : mars 2025</p>

        <section style={s.section}>
          <h3 style={s.h3}>1. Données collectées</h3>
          <ul style={s.list}>
            <li><strong>Pseudo</strong> — saisi volontairement, stocké dans votre navigateur (<code>localStorage</code>) et associé aux pixels que vous posez.</li>
            <li><strong>Compte utilisateur</strong> (optionnel) — username et mot de passe haché (<em>bcrypt</em>, jamais en clair) stockés dans notre base de données PostgreSQL.</li>
            <li><strong>Pixels posés</strong> — coordonnées, couleur, pseudo et plateforme, persistés dans Redis et PostgreSQL.</li>
            <li><strong>Adresse IP</strong> — traitée par le serveur nginx pour acheminer les requêtes. Non stockée.</li>
          </ul>
        </section>

        <section style={s.section}>
          <h3 style={s.h3}>2. Finalité du traitement</h3>
          <p>Les données sont utilisées exclusivement pour faire fonctionner l'expérience collaborative VoxelPlace : afficher la toile en temps réel, attribuer les pixels à leur auteur, et prévenir les abus (rate limiting).</p>
        </section>

        <section style={s.section}>
          <h3 style={s.h3}>3. Durée de conservation</h3>
          <ul style={s.list}>
            <li>Pseudo en localStorage : jusqu'à effacement manuel par l'utilisateur.</li>
            <li>Pixels sur la toile : indéfiniment (historique de la toile).</li>
            <li>Compte utilisateur : jusqu'à suppression du compte ou de la plateforme.</li>
          </ul>
        </section>

        <section style={s.section}>
          <h3 style={s.h3}>4. Partage des données</h3>
          <p>Aucune donnée n'est vendue, partagée ou transmise à des tiers. Aucun cookie de tracking, aucune régie publicitaire.</p>
        </section>

        <section style={s.section}>
          <h3 style={s.h3}>5. Vos droits (RGPD)</h3>
          <p>Conformément au <strong>RGPD</strong> et à la loi Informatique et Libertés, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour exercer ces droits, contactez l'administrateur du site.</p>
          <p style={{ marginTop: 8 }}>
            Pour en savoir plus sur vos droits :{' '}
            <a href="https://www.cnil.fr/fr/rgpd-de-quoi-parle-t-on" target="_blank" rel="noopener noreferrer" style={s.link}>
              cnil.fr
            </a>
          </p>
        </section>

        <button style={s.btnClose} onClick={onClose}>Fermer</button>
      </div>
    </>
  )
}

const s = {
  backdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
    zIndex: 400,
  },
  modal: {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 401,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: '32px 36px',
    width: 'min(560px, 90vw)',
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: 'var(--shadow)',
    display: 'flex', flexDirection: 'column', gap: 0,
  },
  closeBtn: {
    position: 'absolute', top: 14, right: 16,
    background: 'none', border: 'none',
    color: 'var(--text-2)', fontSize: 16, cursor: 'pointer',
  },
  title: {
    fontSize: 20, fontWeight: 800,
    color: 'var(--accent)', marginBottom: 4,
  },
  updated: {
    fontSize: 12, color: 'var(--text-3)', marginBottom: 20,
  },
  section: { marginBottom: 20 },
  h3: {
    fontSize: 14, fontWeight: 700,
    color: 'var(--text)', marginBottom: 8,
  },
  list: {
    paddingLeft: 20, fontSize: 13,
    color: 'var(--text-2)', lineHeight: 1.7,
  },
  link: { color: 'var(--accent)' },
  btnClose: {
    marginTop: 8,
    background: 'var(--accent)', border: 'none',
    borderRadius: 'var(--r-md)', color: '#fff',
    padding: '10px 24px', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', alignSelf: 'flex-end',
  },
}
