import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Politique de confidentialité et données personnelles de VoxelPlace.',
}

export default function PrivacyPage() {
  return (
    <div style={{
      position:   'fixed',
      inset:      0,
      overflowY:  'auto',
      background: '#1a1b26',
    }}>
    <main style={{
      maxWidth:   720,
      margin:     '0 auto',
      padding:    '48px 24px',
      color:      '#c0caf5',
      fontFamily: 'system-ui, sans-serif',
      lineHeight: 1.7,
    }}>
      <Link href="/" style={{ color: '#7aa2f7', textDecoration: 'none', fontSize: 14 }}>
        ← Retour au jeu
      </Link>

      <h1 style={{ color: '#e0af68', marginTop: 24, fontSize: 28 }}>
        Politique de confidentialité
      </h1>
      <p style={{ color: '#a9b1d6', fontSize: 13 }}>
        Dernière mise à jour : mai 2025
      </p>

      <Section title="1. Responsable du traitement">
        <p>
          VoxelPlace est un projet étudiant développé dans le cadre du cursus
          Holberton School (RNCP niveau 6 — CDA). Le responsable du traitement
          est l'auteur du projet.
        </p>
      </Section>

      <Section title="2. Données collectées">
        <p>Lors de l'utilisation de VoxelPlace, les données suivantes sont traitées :</p>
        <ul>
          <li><strong>Pseudo</strong> — choisi librement à l'inscription, affiché publiquement sur le canvas.</li>
          <li><strong>Mot de passe</strong> — haché avec bcrypt (10 rounds), jamais stocké en clair.</li>
          <li><strong>Activité de jeu</strong> — coordonnées et couleur de chaque pixel posé, horodatage.</li>
          <li><strong>Adresse IP</strong> — utilisée temporairement pour le rate limiting (non stockée en base).</li>
        </ul>
      </Section>

      <Section title="3. Finalité du traitement">
        <p>Les données sont utilisées exclusivement pour :</p>
        <ul>
          <li>Permettre l'authentification et la gestion du compte.</li>
          <li>Afficher l'historique des pixels posés sur le canvas.</li>
          <li>Prévenir les abus (spam, bannissement).</li>
          <li>Générer des statistiques anonymes d'utilisation.</li>
        </ul>
      </Section>

      <Section title="4. Stockage local (localStorage)">
        <p>
          L'application stocke dans votre navigateur (<code>localStorage</code>) :
        </p>
        <ul>
          <li><code>voxelplace:token</code> — jeton JWT d'authentification (expiration 7 jours).</li>
          <li><code>voxelplace:username</code> — votre pseudo, pour l'affichage.</li>
          <li><code>voxelplace:cookies-consent</code> — votre choix concernant ce bandeau.</li>
        </ul>
        <p>
          Aucun cookie tiers, traceur publicitaire ou outil d'analyse externe n'est utilisé.
        </p>
      </Section>

      <Section title="5. Durée de conservation">
        <ul>
          <li>Compte et historique de pixels : conservés jusqu'à suppression du compte.</li>
          <li>Données de session (JWT) : expiration automatique après 7 jours.</li>
        </ul>
      </Section>

      <Section title="6. Vos droits (RGPD)">
        <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :</p>
        <ul>
          <li><strong>Droit d'accès</strong> — consulter vos données via votre profil public.</li>
          <li><strong>Droit de rectification</strong> — nous contacter pour corriger vos données.</li>
          <li>
            <strong>Droit à l'effacement</strong> — supprimer votre compte et toutes vos données
            via <code>DELETE /api/auth/account</code> (authentification requise).
          </li>
          <li><strong>Droit d'opposition</strong> — vous pouvez jouer en mode lecture seule sans créer de compte.</li>
        </ul>
      </Section>

      <Section title="7. Sécurité">
        <p>
          Les communications sont chiffrées via HTTPS (Tailscale Funnel, certificat TLS automatique).
          Les mots de passe sont hachés avec bcrypt. Les requêtes SQL utilisent des paramètres
          préparés pour prévenir les injections.
        </p>
      </Section>

      <Section title="8. Contact">
        <p>
          Pour toute question relative à vos données personnelles, vous pouvez contacter
          le responsable du traitement via GitHub :{' '}
          <a
            href="https://github.com/MaKSiiMe/VoxelPlace"
            style={{ color: '#7aa2f7' }}
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/MaKSiiMe/VoxelPlace
          </a>
        </p>
      </Section>
    </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ color: '#7aa2f7', fontSize: 18, marginBottom: 8 }}>{title}</h2>
      {children}
    </section>
  )
}
