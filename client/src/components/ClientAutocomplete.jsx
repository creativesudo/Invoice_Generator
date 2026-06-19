import { useState, useEffect, useRef } from 'react';
import { searchClients } from '../api/client';

export default function ClientAutocomplete({ value, onChange, onSelect, onFieldBlur }) {
  const [query, setQuery] = useState(value.company_name || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setQuery(value.company_name || '');
  }, [value.company_name]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSearch(text) {
    setQuery(text);
    onChange({ ...value, company_name: text });

    if (text.trim().length < 1) {
      setSuggestions([]);
      return;
    }

    try {
      const results = await searchClients(text);
      setSuggestions(results);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    }
  }

  function handleSelect(client) {
    setQuery(client.company_name);
    onSelect(client);
    setShowSuggestions(false);
    onFieldBlur?.();
  }

  return (
    <div className="autocomplete" ref={wrapperRef}>
      <label>
        Company Name *
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={onFieldBlur}
          placeholder="Start typing to search saved clients"
          required
        />
      </label>
      {showSuggestions && suggestions.length > 0 && (
        <ul className="autocomplete-list">
          {suggestions.map((client) => (
            <li key={client.id}>
              <button type="button" onClick={() => handleSelect(client)}>
                {client.company_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
