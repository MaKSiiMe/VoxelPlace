'use client'

import { ROLE_COOLDOWNS, STREAK_COOLDOWNS } from '@voxelplace/types'
import { Dialog, Kbd } from '@shared/ui'

const seconds = (ms: number) => `${Math.round(ms / 1000)} s`

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">{title}</h3>
      {children}
    </section>
  )
}

function Control({ keys, children }: { keys: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-fg-muted">{keys}</dt>
      {/* L'action ne se coupe jamais : c'est le libellé des touches qui passe à la ligne */}
      <dd className="shrink-0 whitespace-nowrap text-right text-sm text-fg">{children}</dd>
    </div>
  )
}

/**
 * Aide du jeu. Les durées de cooldown sont lues dans les constantes que le
 * serveur applique : l'ancienne aide annonçait 1 s pour les superusers et 5 s
 * pour les admins (c'est 0), et ignorait la réduction par le streak.
 */
export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Comment jouer" size="md"
      description="Une toile de 2048 × 2048 pixels, partagée en temps réel entre le web et Minecraft.">
      <div className="flex flex-col gap-6">
        <Section title="Le principe">
          <ol className="flex flex-col gap-2 text-sm text-fg">
            {[
              'Connecte-toi pour pouvoir poser des pixels.',
              'Choisis une couleur dans la palette en bas de l\'écran.',
              'Clique ou touche la toile à l\'endroit voulu.',
              'Attends la fin de ton cooldown avant le pixel suivant.',
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono text-xs text-accent">{i + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </Section>

        <div className="grid gap-6 sm:grid-cols-2">
          <Section title="À la souris">
            <dl className="divide-y divide-line">
              <Control keys="Clic gauche">poser ou inspecter</Control>
              <Control keys={<>Clic droit ou <Kbd>Espace</Kbd> + glisser</>}>se déplacer</Control>
              <Control keys="Molette">zoomer</Control>
              <Control keys={<Kbd>Échap</Kbd>}>ranger la couleur</Control>
            </dl>
          </Section>
          <Section title="Au doigt">
            <dl className="divide-y divide-line">
              <Control keys="Toucher">poser ou inspecter</Control>
              <Control keys="Glisser">se déplacer</Control>
              <Control keys="Pincer">zoomer</Control>
            </dl>
          </Section>
        </div>

        <Section title="Le cooldown">
          <p className="text-sm text-fg-muted">
            Après chaque pixel, patiente <strong className="text-fg">{seconds(ROLE_COOLDOWNS.user)}</strong>.
            Joue régulièrement pour le réduire : ton streak compte tes heures de jeu consécutives,
            et 24 h sans poser de pixel le remettent à zéro.
          </p>
          <ul className="grid grid-cols-3 gap-2">
            {[...STREAK_COOLDOWNS].reverse().map((step) => (
              <li key={step.minHours} className="rounded-control bg-surface-2 px-3 py-2 text-center">
                <span className="block font-mono text-base text-success">{seconds(step.ms)}</span>
                <span className="text-xs text-fg-subtle">dès {step.minHours} h de streak</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Depuis Minecraft">
          <p className="text-sm text-fg-muted">
            Les blocs de béton et de laine posés sur le serveur Minecraft apparaissent ici instantanément,
            et inversement : c&apos;est la même toile.
          </p>
        </Section>
      </div>
    </Dialog>
  )
}
