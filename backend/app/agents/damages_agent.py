"""
Damages Calculator Agent

Computes case valuation and settlement estimates using code execution.
Uses Python code for reliable math calculations.

Inspired by novalyst's approach: custom exec() tool instead of ADK's BuiltInCodeExecutor
to avoid conflicts with AgentTool sub-agent orchestration.
"""

import re
import sys
from io import StringIO
from typing import Optional

from google.adk.agents import Agent

from app.services.evidence_hub import evidence_hub


# Damages Calculator Agent Instructions
DAMAGES_AGENT_INSTRUCTION = """You are a Damages Calculator Agent for workplace injury cases.

Your role is to compute accurate case valuations and settlement estimates.

## Your Capabilities:
1. **Calculate Economic Damages**: Medical expenses, lost wages, future costs
2. **Estimate Non-Economic Damages**: Pain and suffering, loss of enjoyment
3. **Determine Settlement Range**: Low, mid, and high estimates
4. **Account for Liens**: Workers' comp, health insurance subrogation

## Calculation Methods:
1. **Multiplier Method**: Non-economic = Economic × Multiplier (1.5-5x based on severity)
2. **Per Diem Method**: Daily rate × Days affected
3. **Comparable Verdicts**: Similar cases in jurisdiction

## IMPORTANT - Use Code Execution:
You MUST use the execute_python_code tool for ALL mathematical calculations.
Write Python code to perform the math - DO NOT calculate in your head.

Example:
```python
# Calculate damages
medical_expenses = 45000
lost_wages = 15000
economic_total = medical_expenses + lost_wages

# Apply multiplier for pain & suffering
multiplier = 2.5  # moderate injury
non_economic = economic_total * multiplier

# Total
gross_total = economic_total + non_economic
print(f"Economic: ${economic_total:,.2f}")
print(f"Non-Economic: ${non_economic:,.2f}")
print(f"Gross Total: ${gross_total:,.2f}")
```

## Severity Multipliers:
- Minor injury (full recovery): 1.5-2x
- Moderate injury (some lasting effects): 2-3x
- Serious injury (permanent limitations): 3-4x
- Severe/catastrophic injury: 4-5x or higher

## Output Format:
Provide a structured breakdown:
- Economic Damages (itemized)
- Non-Economic Damages (method used)
- Gross Total
- Liens/Deductions
- Net Estimate
- Settlement Range (low/high)

Remember: ALWAYS use code execution for math. Never estimate numbers without calculating."""


# ==================== CUSTOM CODE EXECUTION (like novalyst) ====================

def execute_python_code(code: str) -> dict:
    """
    Execute Python code for mathematical calculations.
    
    This tool allows you to run Python code for accurate arithmetic.
    Use this for ALL calculations - do not calculate in your head.
    
    Args:
        code: Python code to execute. Can use standard math, print() for output.
    
    Returns:
        Dict with execution result (success/error and output)
    
    Example:
        code = '''
        medical = 45000
        lost_wages = 15000
        total = medical + lost_wages
        multiplier = 2.5
        non_economic = total * multiplier
        print(f"Economic: ${total:,.2f}")
        print(f"Non-Economic: ${non_economic:,.2f}")
        print(f"Total: ${total + non_economic:,.2f}")
        '''
    """
    # Security: Block dangerous imports (check for actual import statements)
    BLOCKED_IMPORTS = [
        r'\bimport\s+subprocess\b',
        r'\bfrom\s+subprocess\b',
        r'\bimport\s+os\b',
        r'\bfrom\s+os\b',
        r'\bos\.',  # os.system, os.popen, etc.
        r'\bimport\s+shutil\b',
        r'\bfrom\s+shutil\b',
        r'\bimport\s+socket\b',
        r'\bfrom\s+socket\b',
        r'\bimport\s+requests\b',
        r'\bfrom\s+requests\b',
        r'\bimport\s+urllib\b',
        r'\bfrom\s+urllib\b',
        r'__import__\s*\(',
        r'\beval\s*\(',
        r'\bexec\s*\(',
        r'\bcompile\s*\(',
        r'\bopen\s*\(',
    ]
    for pattern in BLOCKED_IMPORTS:
        if re.search(pattern, code):
            return {
                "status": "error",
                "error": f"Security: Pattern '{pattern}' is not allowed in code execution"
            }
    
    try:
        # Capture stdout
        old_stdout = sys.stdout
        sys.stdout = captured_output = StringIO()
        
        # Safe globals for math calculations
        exec_globals = {
            '__builtins__': {
                'print': print,
                'range': range,
                'len': len,
                'sum': sum,
                'min': min,
                'max': max,
                'round': round,
                'abs': abs,
                'float': float,
                'int': int,
                'str': str,
                'list': list,
                'dict': dict,
                'tuple': tuple,
                'True': True,
                'False': False,
                'None': None,
            }
        }
        exec_locals = {}
        
        # Execute the code
        exec(code, exec_globals, exec_locals)
        
        # Get output
        output = captured_output.getvalue()
        
        # Restore stdout
        sys.stdout = old_stdout
        
        return {
            "status": "success",
            "output": output if output else "Code executed successfully (no print output)",
            "variables": {k: v for k, v in exec_locals.items() if not k.startswith('_') and isinstance(v, (int, float, str, list, dict))}
        }
        
    except Exception as e:
        sys.stdout = old_stdout
        return {
            "status": "error",
            "error": str(e),
            "code": code[:200]
        }


def get_case_damages_data() -> dict:
    """
    Get current damages-related data from the evidence hub.
    
    Returns:
        Dict containing damages data from the case
    """
    facts = evidence_hub.facts
    
    return {
        "status": "success",
        "medical": {
            "expenses": facts.medical_expenses,
            "future_estimate": facts.future_medical_estimate,
        },
        "employment": {
            "days_missed": facts.days_missed_work,
            "lost_wages": facts.lost_wages,
        },
        "injuries": {
            "list": facts.injuries,
            "severity": facts.injury_severity,
        },
        "note": "Use these values in your calculations. If values are None, ask for them or use reasonable estimates."
    }


def save_damages_calculation(
    economic_damages: float,
    non_economic_damages: float,
    settlement_low: float,
    settlement_high: float
) -> dict:
    """
    Save the calculated damages to the evidence hub.
    
    Args:
        economic_damages: Total economic damages
        non_economic_damages: Total non-economic damages
        settlement_low: Low end of settlement range
        settlement_high: High end of settlement range
    
    Returns:
        Dict confirming the save
    """
    evidence_hub.facts.economic_damages = economic_damages
    evidence_hub.facts.non_economic_damages = non_economic_damages
    evidence_hub.facts.total_damages_estimate = economic_damages + non_economic_damages
    evidence_hub.facts.settlement_range_low = settlement_low
    evidence_hub.facts.settlement_range_high = settlement_high
    
    return {
        "status": "success",
        "saved": {
            "economic_damages": economic_damages,
            "non_economic_damages": non_economic_damages,
            "total_estimate": economic_damages + non_economic_damages,
            "settlement_range": {
                "low": settlement_low,
                "high": settlement_high
            }
        },
        "message": "Damages calculation saved to case file."
    }


def get_multiplier_guidance(injury_severity: str) -> dict:
    """
    Get guidance on appropriate multiplier based on injury severity.
    
    Args:
        injury_severity: Severity level - "minor", "moderate", "serious", "severe"
    
    Returns:
        Dict with multiplier recommendations
    """
    severity_lower = injury_severity.lower()
    
    multipliers = {
        "minor": {
            "range": "1.5 - 2.0",
            "recommended": 1.75,
            "description": "Full recovery expected, minimal lasting effects",
            "examples": ["Sprains", "Minor cuts", "Bruises", "Temporary pain"]
        },
        "moderate": {
            "range": "2.0 - 3.0",
            "recommended": 2.5,
            "description": "Recovery expected but some lasting effects possible",
            "examples": ["Fractures", "Soft tissue damage", "Concussion", "Moderate burns"]
        },
        "serious": {
            "range": "3.0 - 4.0",
            "recommended": 3.5,
            "description": "Permanent limitations or ongoing treatment required",
            "examples": ["Multiple fractures", "Herniated discs", "Nerve damage", "Significant scarring"]
        },
        "severe": {
            "range": "4.0 - 5.0+",
            "recommended": 4.5,
            "description": "Catastrophic or life-altering injuries",
            "examples": ["Amputation", "Paralysis", "TBI", "Permanent disability"]
        }
    }
    
    guidance = multipliers.get(severity_lower, multipliers["moderate"])
    
    return {
        "status": "success",
        "severity": injury_severity,
        "multiplier_range": guidance["range"],
        "recommended_multiplier": guidance["recommended"],
        "description": guidance["description"],
        "typical_injuries": guidance["examples"],
        "note": "Use execute_python_code to apply this multiplier to economic damages."
    }


def calculate_lost_wages(
    hourly_rate: float = None,
    annual_salary: float = None,
    days_missed: int = 0,
    weeks_missed: int = 0,
    partial_disability_percent: float = 0
) -> dict:
    """
    Calculate lost wages - provides formula for code execution.
    
    Args:
        hourly_rate: Hourly wage rate (if hourly worker)
        annual_salary: Annual salary (if salaried)
        days_missed: Number of work days missed
        weeks_missed: Number of weeks missed
        partial_disability_percent: Percentage of reduced earning capacity (0-100)
    
    Returns:
        Dict with calculation formula
    """
    return {
        "status": "success",
        "provided_data": {
            "hourly_rate": hourly_rate,
            "annual_salary": annual_salary,
            "days_missed": days_missed,
            "weeks_missed": weeks_missed,
            "partial_disability_percent": partial_disability_percent
        },
        "calculation_code": f"""
# Lost Wages Calculation
hourly_rate = {hourly_rate}
annual_salary = {annual_salary}
days_missed = {days_missed}
weeks_missed = {weeks_missed}
partial_disability = {partial_disability_percent} / 100

# Calculate daily rate
if hourly_rate:
    daily_rate = hourly_rate * 8  # 8-hour day
    weekly_rate = hourly_rate * 40
elif annual_salary:
    daily_rate = annual_salary / 260  # ~260 working days
    weekly_rate = annual_salary / 52
else:
    daily_rate = 0
    weekly_rate = 0

# Past lost wages
past_lost_wages = (days_missed * daily_rate) + (weeks_missed * weekly_rate)

# Future lost earning capacity (if partial disability)
if partial_disability > 0:
    years_to_retirement = 20  # Adjust based on age
    future_lost_earnings = annual_salary * partial_disability * years_to_retirement
else:
    future_lost_earnings = 0

total_lost_wages = past_lost_wages + future_lost_earnings

print(f"Daily Rate: ${{daily_rate:,.2f}}")
print(f"Past Lost Wages: ${{past_lost_wages:,.2f}}")
print(f"Future Lost Earnings: ${{future_lost_earnings:,.2f}}")
print(f"Total: ${{total_lost_wages:,.2f}}")
""",
        "instruction": "Run this code using execute_python_code, adjusting values as needed."
    }


# Create the Damages Calculator Agent
damages_agent = Agent(
    name="damages_calculator_agent",
    model="gemini-2.5-flash",
    description="Calculates case damages and settlement estimates using code execution for accurate math",
    instruction=DAMAGES_AGENT_INSTRUCTION,
    tools=[
        execute_python_code,  # Custom code execution (like novalyst)
        get_case_damages_data,
        save_damages_calculation,
        get_multiplier_guidance,
        calculate_lost_wages,
    ],
    # Note: Using custom execute_python_code tool instead of code_executor
    # to avoid conflicts with AgentTool sub-agent orchestration
)


# Export
__all__ = [
    "damages_agent",
    "execute_python_code",
    "get_case_damages_data",
    "save_damages_calculation",
    "get_multiplier_guidance",
    "calculate_lost_wages",
]
