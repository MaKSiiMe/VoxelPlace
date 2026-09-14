// @vitest-environment jsdom
import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Button, IconButton, Dialog, SettingsIcon } from '../shared/ui'

afterEach(cleanup)

describe('<Button />', () => {
  test('est un bouton de type button par défaut — jamais un submit involontaire', () => {
    render(<Button>Valider</Button>)
    expect(screen.getByRole('button', { name: 'Valider' }).getAttribute('type')).toBe('button')
  })

  test('désactivé, il ne déclenche rien', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Valider</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('<IconButton />', () => {
  test('tire son nom accessible du libellé obligatoire', () => {
    render(<IconButton label="Paramètres" icon={<SettingsIcon />} />)
    expect(screen.getByRole('button', { name: 'Paramètres' })).toBeTruthy()
  })

  test('expose son état de bascule', () => {
    render(<IconButton label="Classement" icon={<SettingsIcon />} pressed />)
    expect(screen.getByRole('button', { name: 'Classement' }).getAttribute('aria-pressed')).toBe('true')
  })

  test('l\'icône est décorative et l\'infobulle ne double pas l\'annonce', () => {
    const { container } = render(<IconButton label="Aide" icon={<SettingsIcon />} />)
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getAllByText('Aide')[0].closest('[role="presentation"]')).toBeTruthy()
  })
})

function DialogHarness({ onClose = vi.fn() }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Ouvrir</Button>
      <Dialog open={open} onClose={() => { onClose(); setOpen(false) }} title="Paramètres" description="Réglages du compte">
        <p>Contenu</p>
      </Dialog>
    </>
  )
}

describe('<Dialog />', () => {
  test('s\'ouvre en modale, nommée par son titre et décrite', async () => {
    render(<DialogHarness />)
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    const dialog = document.querySelector('dialog')!
    expect(dialog.hasAttribute('open')).toBe(true)
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Paramètres')
    expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toBe('Réglages du compte')
  })

  test('Échap passe par React au lieu de fermer la fenêtre dans son dos', async () => {
    const onClose = vi.fn()
    render(<DialogHarness onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    const dialog = document.querySelector('dialog')!
    const cancel = new Event('cancel', { cancelable: true })
    fireEvent(dialog, cancel)   // fireEvent enveloppe l'événement dans act()
    expect(cancel.defaultPrevented).toBe(true)
    expect(onClose).toHaveBeenCalledOnce()
    expect(dialog.hasAttribute('open')).toBe(false)
  })

  test('se ferme au clic sur le fond, pas au clic dans le panneau', async () => {
    const onClose = vi.fn()
    render(<DialogHarness onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    fireEvent.click(screen.getByText('Contenu'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(document.querySelector('dialog')!)
    expect(onClose).toHaveBeenCalledOnce()
  })

  test('se ferme au bouton étiqueté', async () => {
    const onClose = vi.fn()
    render(<DialogHarness onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
