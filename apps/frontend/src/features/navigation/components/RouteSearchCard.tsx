import { useEffect, useRef, useState } from 'react';
import styles from '../../../pages/NavigationPage.module.css';
import type { PlaceItem, SearchTargetMode } from '../types';
import { POPULAR_ORIGINS, POPULAR_CARPARKS, POPULAR_DESTINATIONS } from '../constants';

interface RouteSearchCardProps {
  searchTarget: SearchTargetMode;
  onTargetChange: (target: SearchTargetMode) => void;
  currentTargetName: string;
  onSelectPlace: (place: PlaceItem) => void;
  onGetCurrentLocation: () => void;
}

export function RouteSearchCard({
  searchTarget,
  onTargetChange,
  currentTargetName,
  onSelectPlace,
  onGetCurrentLocation,
}: RouteSearchCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const targetPresetList =
    searchTarget === 'origin'
      ? POPULAR_ORIGINS
      : searchTarget === 'carpark'
      ? POPULAR_CARPARKS
      : POPULAR_DESTINATIONS;

  const activeSuggestions = searchQuery.trim() ? suggestions : targetPresetList;

  // Real-time debounced search using Google Places API (New) with fallback
  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const queryTerm = searchTarget === 'carpark' ? `${searchQuery} carpark` : searchQuery;
        const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
          },
          body: JSON.stringify({
            input: queryTerm,
            includedRegionCodes: ['sg'],
          }),
        });

        const data = await res.json();
        if (data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          interface PlacePrediction {
            placeId?: string;
            place?: string;
            structuredFormat?: {
              mainText?: { text?: string };
              secondaryText?: { text?: string };
            };
            text?: { text?: string };
          }
          const formatted: PlaceItem[] = data.suggestions.map((item: { placePrediction: PlacePrediction }) => ({
            placeId: item.placePrediction.placeId || item.placePrediction.place || '',
            main: item.placePrediction.structuredFormat?.mainText?.text || item.placePrediction.text?.text || 'Location',
            sub: item.placePrediction.structuredFormat?.secondaryText?.text || 'Singapore',
          }));
          setSuggestions(formatted);
          setShowDropdown(true);
        } else {
          // Local fallback filter
          const fallbackSource =
            searchTarget === 'origin'
              ? POPULAR_ORIGINS
              : searchTarget === 'carpark'
              ? POPULAR_CARPARKS
              : POPULAR_DESTINATIONS;
          const matches = fallbackSource.filter((d) =>
            d.main.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setSuggestions(matches);
          setShowDropdown(matches.length > 0);
        }
      } catch {
        const fallbackSource =
          searchTarget === 'origin'
            ? POPULAR_ORIGINS
            : searchTarget === 'carpark'
            ? POPULAR_CARPARKS
            : POPULAR_DESTINATIONS;
        const matches = fallbackSource.filter((d) =>
          d.main.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setSuggestions(matches);
        setShowDropdown(matches.length > 0);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, searchTarget, apiKey]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={styles.searchCardContainer}>
      {/* Triple Mode Switcher: Start (A), Carpark (P), Destination (B) */}
      <div className={styles.targetTabs}>
        <button
          type="button"
          className={`${styles.targetTab} ${searchTarget === 'origin' ? styles.targetTabActive : ''}`}
          onClick={() => {
            onTargetChange('origin');
            setSearchQuery('');
            setShowDropdown(true);
          }}
        >
          📍 Start (A)
        </button>
        <button
          type="button"
          className={`${styles.targetTab} ${searchTarget === 'carpark' ? styles.targetTabActive : ''}`}
          onClick={() => {
            onTargetChange('carpark');
            setSearchQuery('');
            setShowDropdown(true);
          }}
        >
          🅿️ Carpark (P)
        </button>
        <button
          type="button"
          className={`${styles.targetTab} ${searchTarget === 'destination' ? styles.targetTabActive : ''}`}
          onClick={() => {
            onTargetChange('destination');
            setSearchQuery('');
            setShowDropdown(true);
          }}
        >
          🏁 Dest (B)
        </button>
      </div>

      {/* Search Capsule Input */}
      <div className={styles.searchCapsule}>
        <span className={styles.searchIcon}>
          {searchTarget === 'origin' ? '📍' : searchTarget === 'carpark' ? '🅿️' : '🏁'}
        </span>
        <input
          type="text"
          className={styles.searchInput}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          placeholder={`${searchTarget === 'origin' ? 'Start' : searchTarget === 'carpark' ? 'Carpark' : 'Destination'}: ${currentTargetName}`}
        />
        {searchQuery ? (
          <span
            className={styles.filterIcon}
            onClick={() => {
              setSearchQuery('');
              setShowDropdown(false);
            }}
            title="Clear"
          >
            ✕
          </span>
        ) : (
          <span className={styles.filterIcon} title="Filters">
            🎚️
          </span>
        )}
      </div>

      {/* Suggestion Dropdown */}
      {showDropdown && (
        <div className={styles.suggestionsDropdown}>
          {/* Quick Option: Use Current Location (always accessible) */}
          <div
            className={styles.currentLocationOption}
            onClick={() => {
              setShowDropdown(false);
              onGetCurrentLocation();
            }}
          >
            <span className={styles.currentLocationIcon}>🎯</span>
            <div className={styles.currentLocationText}>
              <div className={styles.currentLocationMain}>Use My Current Location</div>
              <div className={styles.currentLocationSub}>GPS positioning for Start Point (A)</div>
            </div>
          </div>

          <div className={styles.dropdownSectionHeader}>
            {searchTarget === 'origin'
              ? 'Popular Starting Points (A)'
              : searchTarget === 'carpark'
              ? 'Popular Singapore Carparks (P)'
              : 'Popular Destinations (B)'}
          </div>

          {isSearching && (
            <div className={styles.dropdownStatusNotice}>
              Searching Google Places Singapore...
            </div>
          )}

          {activeSuggestions.map((item) => (
            <div
              key={item.placeId + item.main}
              className={styles.suggestionItem}
              onClick={() => {
                setShowDropdown(false);
                setSearchQuery('');
                onSelectPlace(item);
              }}
            >
              <span className={styles.suggestionIcon}>
                {searchTarget === 'origin' ? '📍' : searchTarget === 'carpark' ? '🅿️' : '🏁'}
              </span>
              <div className={styles.suggestionText}>
                <div className={styles.suggestionMain}>{item.main}</div>
                <div className={styles.suggestionSecondary}>{item.sub}</div>
              </div>
              {item.availableLots !== undefined && (
                <span className={styles.lotBadge}>
                  🟢 {item.availableLots} lots
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

