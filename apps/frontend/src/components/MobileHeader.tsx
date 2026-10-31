import { useState } from 'react';
import styles from './MobileHeader.module.css';
import { MenuIcon, SearchIcon, HeartIcon, UserIcon, LogOutIcon } from './icons';

export interface MobileHeaderProps {
  title?: string;
  onNavigate?: (page: 'search' | 'favourites' | 'profile' | 'navigation') => void;
  onLogout?: () => void;
  rightAction?: React.ReactNode;
  isGuest?: boolean;
}

export function MobileHeader({
  title = 'Smart Parking',
  onNavigate,
  onLogout,
  rightAction,
  isGuest = false,
}: MobileHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <header className={styles.mobileHeaderBar}>
        <button
          type="button"
          className={styles.hamburgerButton}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="Navigation menu"
          aria-expanded={isOpen}
          title="Navigation menu"
        >
          <MenuIcon size={22} />
        </button>

        {title && <span className={styles.headerTitle}>{title}</span>}

        <div className={styles.rightActionSlot}>
          {rightAction || <div style={{ width: 22 }} />}
        </div>
      </header>

      {isOpen && (
        <div
          className={styles.sideNavOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Side navigation"
          onClick={() => setIsOpen(false)}
        >
          <div className={styles.sideNavDrawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sideNavBanner}>
              <div className={styles.bannerText}>Smart Parking</div>
            </div>
            <div className={styles.sideNavMenu}>
              <button
                type="button"
                className={styles.sideNavItem}
                onClick={() => {
                  setIsOpen(false);
                  onNavigate?.('navigation');
                }}
              >
                <SearchIcon size={20} className={styles.sideNavIcon} />
                <span className={styles.sideNavItemLabel}>Search</span>
              </button>

              <button
                type="button"
                className={styles.sideNavItem}
                aria-label="Favourites"
                onClick={() => {
                  setIsOpen(false);
                  onNavigate?.('favourites');
                }}
              >
                <HeartIcon size={20} className={styles.sideNavHeartIcon} />
                <span className={styles.sideNavItemLabel}>
                  Favourites{isGuest ? ' (Sign in required)' : ''}
                </span>
              </button>

              <button
                type="button"
                className={styles.sideNavItem}
                aria-label="Profile"
                onClick={() => {
                  setIsOpen(false);
                  onNavigate?.('profile');
                }}
              >
                <UserIcon size={20} className={styles.sideNavIcon} />
                <span className={styles.sideNavItemLabel}>
                  {isGuest ? 'Guest Profile' : 'Profile'}
                </span>
              </button>

              <div className={styles.sideNavDivider} />

              <button
                type="button"
                className={`${styles.sideNavItem} ${styles.sideNavLogout}`}
                aria-label={isGuest ? 'Log in or register' : 'Log out'}
                onClick={() => {
                  setIsOpen(false);
                  onLogout?.();
                }}
              >
                <LogOutIcon size={20} className={styles.sideNavIcon} />
                <span className={styles.sideNavItemLabel}>
                  {isGuest ? 'Log in / Register' : 'Log out'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

