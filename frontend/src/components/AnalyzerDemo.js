import { useState } from "react";
import { ArrowLeft, Play, Loader2 } from "lucide-react";
import ResultsDashboard from "@/components/ResultsDashboard";

const SAMPLE_JS = `// Example: Order Processing Module
function processOrder(items, user, config, discountRules, shippingZones, taxConfig) {
  if (!items || items.length === 0) return { error: "No items" };
  
  let total = 0;
  let discountApplied = false;
  
  for (const item of items) {
    if (item.price > 100 && user.isPremium) {
      if (discountRules.premiumDiscount > 0) {
        item.finalPrice = item.price * (1 - discountRules.premiumDiscount);
        discountApplied = true;
      } else {
        item.finalPrice = item.price;
      }
    } else if (item.quantity > 10) {
      if (config.bulkEnabled) {
        item.finalPrice = item.price * 0.9;
      } else {
        item.finalPrice = item.price;
      }
    } else if (item.category === "electronics" && user.memberSince < 2020) {
      item.finalPrice = item.price * 0.95;
    } else {
      item.finalPrice = item.price;
    }
    
    total += item.finalPrice * item.quantity;
  }
  
  // Apply tax
  for (const zone of shippingZones) {
    if (zone.country === user.country) {
      if (zone.taxRate > 0) {
        total *= (1 + zone.taxRate);
      }
      break;
    }
  }
  
  if (total > 500 && discountApplied) {
    total *= 0.98; // extra 2% off for large premium orders
  }
  
  return {
    items,
    total: Math.round(total * 100) / 100,
    discount: discountApplied,
    user: user.id
  };
}

function validateItem(item) {
  if (!item.name) return false;
  if (item.price <= 0) return false;
  if (item.quantity <= 0) return false;
  return true;
}

function formatCurrency(amount) {
  return "$" + amount.toFixed(2);
}`;

const SAMPLE_PY = `# Example: Data Pipeline Processor
def process_data_pipeline(raw_data, config, validators, transformers, output_handlers, error_handlers):
    """Process raw data through a configurable pipeline."""
    results = []
    errors = []
    
    for record in raw_data:
        if not record or not isinstance(record, dict):
            errors.append({"error": "Invalid record", "data": record})
            continue
            
        # Validate
        is_valid = True
        for validator in validators:
            if validator.type == "required":
                for field in validator.fields:
                    if field not in record:
                        is_valid = False
                        errors.append({"error": f"Missing {field}", "record": record.get("id")})
                        break
            elif validator.type == "range":
                if record.get(validator.field, 0) < validator.min_val:
                    is_valid = False
                elif record.get(validator.field, 0) > validator.max_val:
                    is_valid = False
            elif validator.type == "pattern":
                import re
                if not re.match(validator.pattern, str(record.get(validator.field, ""))):
                    is_valid = False
        
        if not is_valid:
            continue
            
        # Transform
        for transformer in transformers:
            if transformer.condition and not transformer.condition(record):
                continue
            try:
                record = transformer.apply(record)
            except Exception as e:
                if config.get("strict_mode"):
                    raise
                else:
                    errors.append({"error": str(e), "record": record.get("id")})
                    
        results.append(record)
    
    # Output
    for handler in output_handlers:
        try:
            handler.write(results)
        except Exception as e:
            for error_handler in error_handlers:
                error_handler.handle(e)
    
    return {"results": results, "errors": errors, "count": len(results)}


def validate_config(config):
    if not config:
        return False
    if "pipeline_name" not in config:
        return False
    if "version" not in config:
        return False
    return True


def get_record_id(record):
    return record.get("id", "unknown")`;

export default function AnalyzerDemo({ onAnalyze, result, loading, onBack }) {
  const [code, setCode] = useState(SAMPLE_JS);
  const [filename, setFilename] = useState("orderProcessor.js");
  const [activeTab, setActiveTab] = useState("javascript");

  const handleSwitchSample = (lang) => {
    setActiveTab(lang);
    if (lang === "javascript") {
      setCode(SAMPLE_JS);
      setFilename("orderProcessor.js");
    } else {
      setCode(SAMPLE_PY);
      setFilename("pipeline.py");
    }
  };

  if (result) {
    return <ResultsDashboard result={result} onBack={onBack} />;
  }

  return (
    <main className="analyzer-demo" data-testid="analyzer-demo">
      <div className="demo-header-row">
        <button className="btn-back" data-testid="back-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h2 className="demo-title" data-testid="demo-title">Live Code Analyzer</h2>
      </div>

      <div className="demo-controls">
        <div className="lang-tabs" data-testid="lang-tabs">
          <button
            className={`lang-tab ${activeTab === "javascript" ? "active" : ""}`}
            data-testid="lang-tab-js"
            onClick={() => handleSwitchSample("javascript")}
          >
            JavaScript
          </button>
          <button
            className={`lang-tab ${activeTab === "python" ? "active" : ""}`}
            data-testid="lang-tab-py"
            onClick={() => handleSwitchSample("python")}
          >
            Python
          </button>
        </div>

        <div className="filename-row">
          <label>Filename:</label>
          <input
            type="text"
            className="filename-input"
            data-testid="filename-input"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
          />
        </div>
      </div>

      <div className="code-editor-wrapper" data-testid="code-editor">
        <div className="editor-header">
          <div className="editor-dots">
            <span className="dot red" /><span className="dot yellow" /><span className="dot green" />
          </div>
          <span className="editor-filename">{filename}</span>
        </div>
        <textarea
          className="code-textarea"
          data-testid="code-textarea"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          rows={20}
        />
      </div>

      <button
        className="btn-analyze"
        data-testid="analyze-btn"
        onClick={() => onAnalyze(code, filename)}
        disabled={loading || !code.trim()}
      >
        {loading ? (
          <><Loader2 size={18} className="spin" /> Analyzing...</>
        ) : (
          <><Play size={18} /> Analyze Code</>
        )}
      </button>
    </main>
  );
}
