import { useEffect, useRef, useState } from 'react';
import { FiCheck, FiChevronDown } from 'react-icons/fi';

const CustomSelect = ({
  id,
  value,
  onChange,
  options = [],
  ariaLabel = 'Choose an option',
  placeholder = 'Select an option',
  disabled = false
}) => {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((option) => String(option.value) === String(value));
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIndex));

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const choose = (option) => {
    if (!option) return;
    onChange(option.value);
    setOpen(false);
  };

  const handleKeyDown = (event) => {
    if (!options.length || disabled) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      } else {
        setActiveIndex((current) => Math.min(options.length - 1, current + 1));
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : options.length - 1);
      } else {
        setActiveIndex((current) => Math.max(0, current - 1));
      }
    } else if (event.key === 'Home' && open) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End' && open) {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      choose(options[activeIndex]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  return (
    <div className="custom-select-field" ref={rootRef}>
      <button
        id={id}
        type="button"
        className="custom-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id + '-options'}
        aria-activedescendant={open ? id + '-option-' + activeIndex : undefined}
        disabled={disabled}
        onClick={() => {
          setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
          setOpen((current) => !current);
        }}
        onKeyDown={handleKeyDown}
      >
        <span className={!selectedOption ? 'custom-select-placeholder' : ''}>
          {selectedOption?.label || placeholder}
        </span>
        <FiChevronDown aria-hidden="true" />
      </button>

      {open && (
        <div className="custom-select-menu" id={id + '-options'} role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => {
            const selected = String(option.value) === String(value);
            return (
              <button
                type="button"
                role="option"
                id={id + '-option-' + index}
                aria-selected={selected}
                className={'custom-select-option' + (selected ? ' custom-select-option-selected' : '') + (activeIndex === index ? ' custom-select-option-active' : '')}
                key={String(option.value)}
                tabIndex={-1}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
              >
                <span>{option.label}</span>
                {selected && <FiCheck aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
