# backend/app/api/languages.py
from fastapi import APIRouter
from app.services.piston import get_template_languages

router = APIRouter()

@router.get("", response_model=list[dict])
def get_supported_languages():
    """
    Get list of supported programming languages based on available templates.
    Returns a list of language objects with id and display name.
    """
    template_languages = get_template_languages()
    
    # Define display names for each language
    display_names = {
        "python": "Python",
        "java": "Java",
        "c++": "C++",
        "cpp": "C++",
        "javascript": "JavaScript",
        "typescript": "TypeScript",
        "c": "C",
        "go": "Go",
        "rust": "Rust",
        "ruby": "Ruby",
    }
    
    # Build unique list of supported languages
    languages = []
    seen = set()
    
    for template_file, piston_lang in template_languages.items():
        # Use lowercase version as the ID
        lang_id = piston_lang.lower().replace("+", "p")  # c++ -> cpp for frontend
        if lang_id == "c++":
            lang_id = "cpp"
        
        if lang_id not in seen:
            seen.add(lang_id)
            display_name = display_names.get(piston_lang.lower(), piston_lang.capitalize())
            languages.append({
                "id": lang_id,
                "name": display_name,
                "piston_name": piston_lang
            })
    
    # Sort by name
    languages.sort(key=lambda x: x["name"])
    
    return languages

