import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResultList from './ResultList'
import { parseItem } from '../stac/search'
import { makeItem } from '../test/fixtures/items'

const older = parseItem(makeItem('S2A_old', { datetime: '2026-08-01T10:00:00Z' }))
const newer = parseItem(makeItem('S2B_new'))

function setup(selection = { left: null, right: null } as Parameters<typeof ResultList>[0]['selection']) {
  const handlers = { onHover: vi.fn(), onShow: vi.fn(), onCompare: vi.fn(), onLoadMore: vi.fn() }
  render(
    <ResultList scenes={[newer, older]} matched={12} hoveredId={null} selection={selection} hasMore loadingMore={false} {...handlers} />,
  )
  return handlers
}

describe('ResultList', () => {
  it('lists the scenes with date and cloud cover', () => {
    setup()
    expect(screen.getByText('2 of 12 scenes, newest first')).toBeInTheDocument()
    const items = screen.getAllByRole('listitem')
    expect(within(items[0]).getByText(/12 Sept 2026/)).toBeInTheDocument()
    expect(within(items[0]).getByText('☁ 3%')).toBeInTheDocument()
  })

  it('only allows comparing once a scene is shown', async () => {
    const handlers = setup()
    const [first] = screen.getAllByRole('listitem')
    expect(within(first).getByRole('button', { name: 'Compare' })).toBeDisabled()

    await userEvent.click(within(first).getByRole('button', { name: 'Show' }))
    expect(handlers.onShow).toHaveBeenCalledWith(newer)
  })

  it('compares another scene with the shown one', async () => {
    const handlers = setup({ left: newer, right: null })
    const [first, second] = screen.getAllByRole('listitem')
    expect(within(first).getByRole('button', { name: 'Compare' })).toBeDisabled()

    await userEvent.click(within(second).getByRole('button', { name: 'Compare' }))
    expect(handlers.onCompare).toHaveBeenCalledWith(older)
  })

  it('loads the next page', async () => {
    const handlers = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(handlers.onLoadMore).toHaveBeenCalled()
  })
})
