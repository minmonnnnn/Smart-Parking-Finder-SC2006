import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileHeader } from './MobileHeader';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MobileHeader component', () => {
  it('renders top mobile header bar with hamburger menu button and title', () => {
    render(<MobileHeader title="Saved locations" />);

    const menuButton = screen.getByRole('button', { name: 'Navigation menu' });
    expect(menuButton).toBeInTheDocument();
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Saved locations')).toBeInTheDocument();

    // Drawer is initially closed
    expect(screen.queryByRole('dialog', { name: 'Side navigation' })).not.toBeInTheDocument();
  });

  it('opens side navigation drawer when hamburger button is clicked', async () => {
    const user = userEvent.setup();
    render(<MobileHeader title="Your profile" />);

    const menuButton = screen.getByRole('button', { name: 'Navigation menu' });
    await user.click(menuButton);

    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    const dialog = screen.getByRole('dialog', { name: 'Side navigation' });
    expect(dialog).toBeInTheDocument();

    // Contains all mobile options
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Favourites' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('triggers onNavigate with navigation when Search is clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<MobileHeader onNavigate={onNavigate} />);

    await user.click(screen.getByRole('button', { name: 'Navigation menu' }));
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(onNavigate).toHaveBeenCalledWith('navigation');
    expect(screen.queryByRole('dialog', { name: 'Side navigation' })).not.toBeInTheDocument();
  });

  it('triggers onNavigate with favourites when Favourites is clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<MobileHeader onNavigate={onNavigate} />);

    await user.click(screen.getByRole('button', { name: 'Navigation menu' }));
    await user.click(screen.getByRole('button', { name: 'Favourites' }));

    expect(onNavigate).toHaveBeenCalledWith('favourites');
    expect(screen.queryByRole('dialog', { name: 'Side navigation' })).not.toBeInTheDocument();
  });

  it('triggers onNavigate with profile when Profile is clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<MobileHeader onNavigate={onNavigate} />);

    await user.click(screen.getByRole('button', { name: 'Navigation menu' }));
    await user.click(screen.getByRole('button', { name: 'Profile' }));

    expect(onNavigate).toHaveBeenCalledWith('profile');
    expect(screen.queryByRole('dialog', { name: 'Side navigation' })).not.toBeInTheDocument();
  });

  it('triggers onLogout callback when Log out is clicked', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    render(<MobileHeader onLogout={onLogout} />);

    await user.click(screen.getByRole('button', { name: 'Navigation menu' }));
    await user.click(screen.getByRole('button', { name: 'Log out' }));

    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Side navigation' })).not.toBeInTheDocument();
  });

  it('closes side navigation drawer when clicking the backdrop overlay', async () => {
    const user = userEvent.setup();
    render(<MobileHeader />);

    await user.click(screen.getByRole('button', { name: 'Navigation menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Side navigation' });
    expect(dialog).toBeInTheDocument();

    await user.click(dialog);
    expect(screen.queryByRole('dialog', { name: 'Side navigation' })).not.toBeInTheDocument();
  });
});

