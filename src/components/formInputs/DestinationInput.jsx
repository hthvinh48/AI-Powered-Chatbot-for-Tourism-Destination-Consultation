import React, { useState } from "react";
import "./formInputs.css";

const POPULAR_DESTINATIONS = [
  "Hà Nội",
  "Thành phố Hồ Chí Minh",
  "Đà Nẵng",
  "Huế",
  "Hội An",
  "Nha Trang",
  "Đà Lạt",
  "Hạ Long",
  "Phú Quốc",
  "Cần Thơ",
  "Quy Nhơn",
  "Sapa",
  "Hà Giang",
  "Tuyên Quang",
];

export default function DestinationInput({ onSubmit, onCancel }) {
  const [destination, setDestination] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleChange = (value) => {
    setDestination(value);
    if (value.trim().length > 0) {
      const filtered = POPULAR_DESTINATIONS.filter((d) =>
        d.toLowerCase().includes(value.toLowerCase())
      );
      setFiltered(filtered);
      setShowSuggestions(true);
    } else {
      setFiltered([]);
      setShowSuggestions(false);
    }
  };

  const handleSelect = (value) => {
    setDestination(value);
    setShowSuggestions(false);
  };

  const handleSubmit = () => {
    const trimmed = destination.trim();
    if (!trimmed) {
      alert("Vui lòng nhập điểm đến");
      return;
    }
    onSubmit({ destination: trimmed });
  };

  return (
    <div className="form-input-container">
      <div className="form-input-group">
        <label>Điểm đến</label>
        <div className="autocomplete-container">
          <input
            type="text"
            value={destination}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => destination && setShowSuggestions(true)}
            placeholder="Nhập thành phố/địa điểm..."
            className="text-input"
          />
          {showSuggestions && filtered.length > 0 && (
            <div className="suggestions-dropdown">
              {filtered.map((suggestion) => (
                <button
                  key={suggestion}
                  className="suggestion-item"
                  onClick={() => handleSelect(suggestion)}
                >
                  🎯 {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="form-buttons">
        <button className="btn-cancel" onClick={onCancel}>
          Hủy
        </button>
        <button className="btn-submit" onClick={handleSubmit}>
          Tiếp tục
        </button>
      </div>
    </div>
  );
}
