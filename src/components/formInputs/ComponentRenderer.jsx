import React, { useState } from "react";
import GroupSizeInput from "./GroupSizeInput";
import InterestsInput from "./InterestsInput";
import OriginInput from "./OriginInput";
import DestinationInput from "./DestinationInput";
import TripDurationInput from "./TripDurationInput";
import BudgetInput from "./BudgetInput";
import SpecialRequestsInput from "./SpecialRequestsInput";

/**
 * Detect Component tags từ message (format: "Component: xxx")
 * @param {string} text - Raw AI response text
 * @returns {Array<{type: string, text: string}>} - List of detected components
 */
function detectComponents(text) {
  if (!text) return [];

  const componentPattern = /Component:\s*(\w+)/gi;
  const matches = [];
  let match;

  while ((match = componentPattern.exec(text)) !== null) {
    const componentType = match[1].toLowerCase();
    matches.push({
      type: componentType,
      fullMatch: match[0],
    });
  }

  return matches;
}

/**
 * Render component dựa trên type
 */
function renderComponent(componentType, onSubmit, onCancel) {
  const TYPE_MAP = {
    groupsize: GroupSizeInput,
    interests: InterestsInput,
    origin: OriginInput,
    destination: DestinationInput,
    tripduration: TripDurationInput,
    budget: BudgetInput,
    specialrequests: SpecialRequestsInput,
  };

  const Component = TYPE_MAP[componentType];

  if (!Component) {
    console.warn(`Unknown component type: ${componentType}`);
    return null;
  }

  return <Component onSubmit={onSubmit} onCancel={onCancel} />;
}

/**
 * ComponentRenderer - Detect và render component inputs từ AI response
 */
export default function ComponentRenderer({ message, onComponentSubmit, onCancel }) {
  const [showComponent, setShowComponent] = useState(true);
  

  if (!message) return null;

const rawJson = extractJsonFromText(message);
const data = safeJsonParse(rawJson);

if (!data) return null;

// Nếu AI trả về mảng gợi ý tìm kiếm khách sạn
if (data.hotel_search_groups && Array.isArray(data.hotel_search_groups)) {
    return (
    <div className="generative-hotel-ui">
        {data.hotel_search_groups.map((group, idx) => (
        <HotelSuggestionGroup key={idx} group={group} />
        ))}
        <div className="ui-actions">
        <button onClick={onCancel}>Đóng gợi ý</button>
        </div>
    </div>
    );
}

  const components = detectComponents(message);
  if (components.length === 0) return null;

  // Get first component (UI sẽ xử lý một component tại một thời điểm)
  const firstComponent = components[0];

  // Extract text trước component tag
  const textBeforeComponent = message
    .split(firstComponent.fullMatch)[0]
    .trim();

  const handleComponentSubmit = (data) => {
    setShowComponent(false);
    if (onComponentSubmit) {
      onComponentSubmit(data);
    }
  };

  const handleCancel = () => {
    setShowComponent(false);
    if (onCancel) {
      onCancel();
    }
  };

  if (!showComponent) {
    return null;
  }

  return (
    <div className="component-renderer-wrapper">
      {textBeforeComponent && (
        <p className="component-prompt-text">{textBeforeComponent}</p>
      )}
      {renderComponent(
        firstComponent.type,
        handleComponentSubmit,
        handleCancel
      )}
    </div>
  );
}

// Export utility functions
export { detectComponents, renderComponent };
