#!/usr/bin/env python3
"""
Recipe Collection Script for Simpler Recipes
Collects highly-rated recipes from popular sites and saves as organized JSON.
"""

import json
import re
import time
import os
from datetime import datetime
from urllib.parse import urlparse
import requests
from dataclasses import dataclass, asdict
from typing import Optional

# Configuration
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "recipe-data")
DELAY_BETWEEN_REQUESTS = 3  # seconds
REQUEST_TIMEOUT = 15  # seconds

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Theme definitions
THEMES = {
    "quick-weeknight-dinners": {
        "name": "Quick Weeknight Dinners",
        "description": "Fast, easy meals ready in 30 minutes or less with simple ingredients",
        "count": 15,
        "search_queries": [
            "quick weeknight dinner recipes under 30 minutes allrecipes",
            "easy 20 minute dinner recipes food network",
            "fast family dinner recipes highly rated",
            "simple weeknight meals serious eats",
            "quick chicken dinner recipes",
            "easy pasta dinner 30 minutes",
            "fast stir fry dinner recipes",
        ],
        "tags_default": ["quick", "weeknight", "easy"],
    },
    "baking-basics": {
        "name": "Baking Basics",
        "description": "Foundational baking recipes and classic favorites everyone should know",
        "count": 12,
        "search_queries": [
            "classic chocolate chip cookies recipe allrecipes",
            "basic banana bread recipe best rated",
            "easy homemade bread recipe beginners",
            "classic apple pie recipe food network",
            "simple vanilla cake recipe from scratch",
            "basic muffin recipe blueberry",
            "easy brownies recipe fudgy",
        ],
        "tags_default": ["baking", "classic", "homemade"],
    },
    "one-pot-meals": {
        "name": "One-Pot Meals",
        "description": "Complete meals with minimal cleanup - everything cooks in one pot or pan",
        "count": 10,
        "search_queries": [
            "one pot chicken and rice recipe highly rated",
            "one pan dinner recipes easy",
            "one pot pasta recipes best",
            "sheet pan dinner recipes",
            "one pot soup recipes hearty",
            "skillet dinner recipes complete meal",
        ],
        "tags_default": ["one-pot", "easy-cleanup", "complete-meal"],
    },
    "healthy-lunches": {
        "name": "Healthy Lunches",
        "description": "Balanced, nutritious meals perfect for meal prep and midday eating",
        "count": 12,
        "search_queries": [
            "healthy lunch recipes meal prep",
            "high protein lunch recipes easy",
            "healthy salad recipes filling",
            "mediterranean lunch recipes",
            "healthy grain bowl recipes",
            "light lunch recipes nutritious",
            "healthy wrap recipes",
        ],
        "tags_default": ["healthy", "lunch", "meal-prep"],
    },
    "comfort-food-classics": {
        "name": "Comfort Food Classics",
        "description": "Hearty, satisfying recipes that bring warmth and nostalgia",
        "count": 10,
        "search_queries": [
            "classic mac and cheese recipe best",
            "homemade meatloaf recipe highly rated",
            "chicken pot pie recipe classic",
            "beef stew recipe traditional",
            "lasagna recipe best ever",
            "mashed potatoes recipe creamy",
            "grilled cheese and tomato soup",
        ],
        "tags_default": ["comfort-food", "hearty", "classic"],
    },
    "breakfast-brunch": {
        "name": "Breakfast & Brunch",
        "description": "Start your day right with these morning favorites and brunch classics",
        "count": 10,
        "search_queries": [
            "fluffy pancakes recipe best",
            "french toast recipe classic",
            "eggs benedict recipe easy",
            "breakfast burrito recipe",
            "homemade waffles recipe",
        ],
        "tags_default": ["breakfast", "brunch", "morning"],
    },
    "grilling-bbq": {
        "name": "Grilling & BBQ",
        "description": "Fire up the grill with these outdoor cooking favorites and smoky flavors",
        "count": 10,
        "search_queries": [
            "bbq ribs recipe best",
            "grilled chicken recipe easy",
            "burger recipe juicy",
            "grilled steak recipe perfect",
            "bbq pulled pork recipe",
        ],
        "tags_default": ["grilling", "bbq", "outdoor"],
    },
    "vegetarian-mains": {
        "name": "Vegetarian Mains",
        "description": "Satisfying meatless main dishes packed with flavor and nutrition",
        "count": 10,
        "search_queries": [
            "vegetarian lasagna recipe",
            "stuffed peppers vegetarian",
            "vegetable stir fry recipe",
            "bean burrito recipe",
            "eggplant parmesan recipe",
        ],
        "tags_default": ["vegetarian", "meatless", "plant-based"],
    },
    "appetizers-party": {
        "name": "Appetizers & Party Food",
        "description": "Crowd-pleasing starters and finger foods perfect for entertaining",
        "count": 10,
        "search_queries": [
            "spinach artichoke dip recipe",
            "buffalo chicken wings recipe",
            "bruschetta recipe easy",
            "deviled eggs recipe best",
            "meatballs appetizer recipe",
        ],
        "tags_default": ["appetizer", "party", "finger-food"],
    },
}

# Curated recipe URLs from diverse sources
# These are known good recipes from reliable sources - verified working URLs
CURATED_RECIPES = {
    "quick-weeknight-dinners": [
        # RecipeTin Eats - verified working URLs
        ("Fried Rice", "https://www.recipetineats.com/egg-fried-rice/", "RecipeTin Eats", "15 min", "Easy"),
        ("Chicken Fried Rice", "https://www.recipetineats.com/chicken-fried-rice/", "RecipeTin Eats", "20 min", "Easy"),
        ("Honey Garlic Chicken", "https://www.recipetineats.com/honey-garlic-chicken/", "RecipeTin Eats", "25 min", "Easy"),
        ("Teriyaki Chicken", "https://www.recipetineats.com/teriyaki-chicken/", "RecipeTin Eats", "20 min", "Easy"),
        # Budget Bytes - verified working URLs
        ("One Pot Pasta", "https://www.budgetbytes.com/one-pot-veggie-pasta/", "Budget Bytes", "25 min", "Easy"),
        ("Creamy Tomato Spinach Pasta", "https://www.budgetbytes.com/creamy-tomato-spinach-pasta/", "Budget Bytes", "20 min", "Easy"),
        ("Beef Stroganoff", "https://www.budgetbytes.com/beef-stroganoff/", "Budget Bytes", "30 min", "Easy"),
        ("Chicken Stir Fry", "https://www.budgetbytes.com/chicken-stir-fry/", "Budget Bytes", "30 min", "Easy"),
        # AllRecipes - verified working URLs
        ("Quick Chicken Stir Fry", "https://www.allrecipes.com/recipe/223382/chicken-stir-fry/", "AllRecipes", "30 min", "Easy"),
        ("Pad Thai", "https://www.allrecipes.com/recipe/42968/pad-thai/", "AllRecipes", "30 min", "Easy"),
        ("Shrimp Scampi", "https://www.allrecipes.com/recipe/229960/shrimp-scampi-with-pasta/", "AllRecipes", "30 min", "Easy"),
        ("Lemon Garlic Salmon", "https://www.recipetineats.com/lemon-garlic-salmon/", "RecipeTin Eats", "25 min", "Easy"),
    ],
    "baking-basics": [
        # RecipeTin Eats - verified working URLs
        ("Chocolate Chip Cookies", "https://www.recipetineats.com/chocolate-chip-cookies/", "RecipeTin Eats", "30 min", "Easy"),
        ("Blueberry Muffins", "https://www.recipetineats.com/moist-blueberry-muffins/", "RecipeTin Eats", "35 min", "Easy"),
        ("Cinnamon Bread", "https://www.recipetineats.com/easy-cinnamon-swirl-quick-bread/", "RecipeTin Eats", "60 min", "Easy"),
        # Sally's Baking Addiction
        ("Classic Sugar Cookies", "https://sallysbakingaddiction.com/best-sugar-cookies/", "Sally's Baking", "30 min", "Easy"),
        ("Homemade Cinnamon Rolls", "https://sallysbakingaddiction.com/easy-cinnamon-rolls-from-scratch/", "Sally's Baking", "3 hrs", "Medium"),
        # Budget Bytes - verified working URLs
        ("Pumpkin Bread", "https://www.budgetbytes.com/pumpkin-bread/", "Budget Bytes", "75 min", "Easy"),
        ("Fudgy Brownies", "https://www.budgetbytes.com/super-fudgy-homemade-brownies/", "Budget Bytes", "45 min", "Easy"),
        # AllRecipes - verified working URLs
        ("Apple Pie", "https://www.allrecipes.com/recipe/12682/apple-pie-by-grandma-ople/", "AllRecipes", "75 min", "Medium"),
        ("Vanilla Cake", "https://www.allrecipes.com/recipe/17481/simple-white-cake/", "AllRecipes", "40 min", "Medium"),
        ("Banana Bread", "https://www.allrecipes.com/recipe/20144/banana-banana-bread/", "AllRecipes", "65 min", "Easy"),
        ("Zucchini Bread", "https://www.allrecipes.com/recipe/6698/moms-zucchini-bread/", "AllRecipes", "60 min", "Easy"),
        ("Lemon Bars", "https://www.allrecipes.com/recipe/10294/the-best-lemon-bars/", "AllRecipes", "50 min", "Easy"),
    ],
    "one-pot-meals": [
        # Budget Bytes - verified working URLs
        ("Slow Cooker Beef Stew", "https://www.budgetbytes.com/slow-cooker-beef-stew/", "Budget Bytes", "8 hrs", "Easy"),
        ("Vegetarian Chili", "https://www.budgetbytes.com/vegetarian-chili/", "Budget Bytes", "45 min", "Easy"),
        ("One Pot Chicken and Rice", "https://www.budgetbytes.com/one-pot-chicken-and-rice/", "Budget Bytes", "45 min", "Easy"),
        ("Italian Wonderpot", "https://www.budgetbytes.com/italian-wonderpot/", "Budget Bytes", "30 min", "Easy"),
        ("Cajun Chicken Pasta", "https://www.budgetbytes.com/cajun-chicken-pasta/", "Budget Bytes", "35 min", "Easy"),
        # RecipeTin Eats - verified working URLs
        ("Chicken Noodle Soup", "https://www.recipetineats.com/homemade-chicken-noodle-soup-from-scratch/", "RecipeTin Eats", "45 min", "Easy"),
        ("Minestrone Soup", "https://www.recipetineats.com/minestrone-soup/", "RecipeTin Eats", "45 min", "Easy"),
        # Cookie and Kate - verified working URLs
        ("Butternut Squash Soup", "https://cookieandkate.com/roasted-butternut-squash-soup/", "Cookie and Kate", "60 min", "Easy"),
        ("Tomato Soup", "https://cookieandkate.com/classic-tomato-soup-recipe/", "Cookie and Kate", "45 min", "Easy"),
        # AllRecipes - verified working URLs
        ("Chili Con Carne", "https://www.allrecipes.com/recipe/78299/boilermaker-tailgate-chili/", "AllRecipes", "2 hrs", "Easy"),
        ("Beef Stew", "https://www.allrecipes.com/recipe/14685/slow-cooker-beef-stew-i/", "AllRecipes", "8 hrs", "Easy"),
    ],
    "healthy-lunches": [
        # Cookie and Kate - verified working URLs
        ("Quinoa Salad", "https://cookieandkate.com/best-quinoa-salad-recipe/", "Cookie and Kate", "30 min", "Easy"),
        # Budget Bytes - verified working URLs
        ("Traditional Chicken Salad", "https://www.budgetbytes.com/chicken-salad-traditional/", "Budget Bytes", "20 min", "Easy"),
        ("Honey Mustard Chicken Salad", "https://www.budgetbytes.com/honey-mustard-chicken-salad/", "Budget Bytes", "25 min", "Easy"),
        ("Greek Chicken Pasta Salad", "https://www.budgetbytes.com/greek-chicken-pasta-salad/", "Budget Bytes", "30 min", "Easy"),
        ("Classic Tuna Salad", "https://www.budgetbytes.com/classic-tuna-salad/", "Budget Bytes", "15 min", "Easy"),
        ("Mediterranean Tuna Salad", "https://www.budgetbytes.com/mediterranean-tuna-salad/", "Budget Bytes", "20 min", "Easy"),
        # RecipeTin Eats - verified working URLs
        ("Coleslaw", "https://www.recipetineats.com/coleslaw/", "RecipeTin Eats", "10 min", "Easy"),
        ("Caesar Salad", "https://www.recipetineats.com/caesar-salad/", "RecipeTin Eats", "20 min", "Easy"),
        ("Potato Salad", "https://www.recipetineats.com/potato-salad/", "RecipeTin Eats", "30 min", "Easy"),
        # AllRecipes - verified working URLs
        ("Guacamole", "https://www.allrecipes.com/recipe/14231/guacamole/", "AllRecipes", "10 min", "Easy"),
        ("Garden Salad", "https://www.allrecipes.com/recipe/14276/strawberry-spinach-salad-i/", "AllRecipes", "15 min", "Easy"),
    ],
    "comfort-food-classics": [
        # RecipeTin Eats - verified working URLs
        ("Mac and Cheese", "https://www.recipetineats.com/baked-mac-and-cheese/", "RecipeTin Eats", "45 min", "Easy"),
        ("Lasagna", "https://www.recipetineats.com/lasagna/", "RecipeTin Eats", "90 min", "Medium"),
        ("Chicken Pot Pie", "https://www.recipetineats.com/chicken-pot-pie/", "RecipeTin Eats", "90 min", "Medium"),
        # Budget Bytes - verified working URLs
        ("Meatloaf", "https://www.budgetbytes.com/classic-homemade-meatloaf/", "Budget Bytes", "75 min", "Easy"),
        ("Beef Stroganoff", "https://www.budgetbytes.com/beef-stroganoff/", "Budget Bytes", "30 min", "Easy"),
        ("Creamy Garlic Chicken", "https://www.budgetbytes.com/creamy-garlic-chicken/", "Budget Bytes", "30 min", "Easy"),
        # Cookie and Kate - verified working URLs
        ("Tomato Soup", "https://cookieandkate.com/classic-tomato-soup-recipe/", "Cookie and Kate", "40 min", "Easy"),
        # AllRecipes - verified working URLs
        ("Grilled Cheese", "https://www.allrecipes.com/recipe/23891/grilled-cheese-sandwich/", "AllRecipes", "15 min", "Easy"),
        ("Fried Chicken", "https://www.allrecipes.com/recipe/8805/crispy-fried-chicken/", "AllRecipes", "45 min", "Medium"),
        ("Spaghetti Meatballs", "https://www.allrecipes.com/recipe/21353/italian-spaghetti-sauce-with-meatballs/", "AllRecipes", "140 min", "Easy"),
    ],
    "breakfast-brunch": [
        # RecipeTin Eats - verified working URLs
        ("Fluffy Pancakes", "https://www.recipetineats.com/pancake-recipe/", "RecipeTin Eats", "20 min", "Easy"),
        ("Waffles", "https://www.recipetineats.com/waffles-recipe/", "RecipeTin Eats", "30 min", "Easy"),
        ("Eggs Benedict", "https://www.recipetineats.com/eggs-benedict/", "RecipeTin Eats", "30 min", "Medium"),
        ("Scrambled Eggs", "https://www.recipetineats.com/scrambled-eggs/", "RecipeTin Eats", "10 min", "Easy"),
        # Pinch of Yum
        ("Sheet Pan Breakfast Burritos", "https://pinchofyum.com/sheet-pan-breakfast-burritos-with-creamy-chipotle-sauce", "Pinch of Yum", "45 min", "Easy"),
        ("Breakfast Sandwich", "https://pinchofyum.com/breakfast-sandwich", "Pinch of Yum", "20 min", "Easy"),
        # Budget Bytes - verified working URLs
        ("French Toast", "https://www.budgetbytes.com/french-toast/", "Budget Bytes", "20 min", "Easy"),
        # Sally's Baking Addiction
        ("Cinnamon Rolls", "https://sallysbakingaddiction.com/easy-cinnamon-rolls-from-scratch/", "Sally's Baking", "3 hrs", "Medium"),
        # AllRecipes - verified working URLs
        ("Crepes", "https://www.allrecipes.com/recipe/16383/basic-crepes/", "AllRecipes", "30 min", "Easy"),
        ("Quiche Lorraine", "https://www.allrecipes.com/recipe/17515/quiche-lorraine-i/", "AllRecipes", "60 min", "Medium"),
    ],
    "grilling-bbq": [
        # RecipeTin Eats - verified working URLs
        ("Sticky Grilled Chicken", "https://www.recipetineats.com/sticky-grilled-chicken/", "RecipeTin Eats", "25 min", "Easy"),
        ("BBQ Pork Ribs", "https://www.recipetineats.com/oven-baked-barbecue-pork-ribs/", "RecipeTin Eats", "2 hrs", "Medium"),
        ("Thai Grilled Chicken", "https://www.recipetineats.com/thai-grilled-chicken-gai-yang/", "RecipeTin Eats", "45 min", "Easy"),
        # Budget Bytes - verified working URLs
        ("Pulled Pork", "https://www.budgetbytes.com/slow-cooker-pulled-pork/", "Budget Bytes", "8 hrs", "Easy"),
        ("Grilled Vegetables", "https://www.budgetbytes.com/grilled-vegetables/", "Budget Bytes", "30 min", "Easy"),
        ("Honey Mustard Chicken Salad", "https://www.budgetbytes.com/honey-mustard-chicken-salad/", "Budget Bytes", "25 min", "Easy"),
        # AllRecipes - verified working URLs
        ("Classic Burger", "https://www.allrecipes.com/recipe/25473/the-perfect-basic-burger/", "AllRecipes", "20 min", "Easy"),
        ("Grilled Shrimp", "https://www.allrecipes.com/recipe/21694/marinated-grilled-shrimp/", "AllRecipes", "50 min", "Easy"),
        ("Grilled Steak", "https://www.allrecipes.com/recipe/143809/best-steak-marinade-in-existence/", "AllRecipes", "30 min", "Easy"),
        ("Honey Soy Chicken", "https://www.recipetineats.com/honey-soy-chicken-marinade-sauce-grilled/", "RecipeTin Eats", "30 min", "Easy"),
    ],
    "vegetarian-mains": [
        # Budget Bytes - verified working URLs
        ("Vegetarian Chili", "https://www.budgetbytes.com/vegetarian-chili/", "Budget Bytes", "45 min", "Easy"),
        ("Tuscan White Bean Pasta", "https://www.budgetbytes.com/tuscan-white-bean-pasta/", "Budget Bytes", "30 min", "Easy"),
        ("Quinoa Black Bean Tacos", "https://www.budgetbytes.com/quinoa-black-bean-tacos/", "Budget Bytes", "30 min", "Easy"),
        ("Easy Vegetable Stir Fry", "https://www.budgetbytes.com/easy-vegetable-stir-fry/", "Budget Bytes", "25 min", "Easy"),
        ("Spicy Coconut Stir Fry", "https://www.budgetbytes.com/spicy-coconut-vegetable-stir-fry/", "Budget Bytes", "30 min", "Easy"),
        ("Sweet Potato Tacos", "https://www.budgetbytes.com/sweet-potato-tacos-with-lime-crema/", "Budget Bytes", "35 min", "Easy"),
        # Cookie and Kate - verified working URLs
        ("Thai Red Curry", "https://cookieandkate.com/thai-red-curry-recipe/", "Cookie and Kate", "40 min", "Easy"),
        # RecipeTin Eats - verified working URLs
        ("Mushroom Risotto", "https://www.recipetineats.com/mushroom-risotto/", "RecipeTin Eats", "50 min", "Medium"),
        ("Vegetable Fried Rice", "https://www.recipetineats.com/egg-fried-rice/", "RecipeTin Eats", "15 min", "Easy"),
        # AllRecipes - verified working URLs
        ("Eggplant Parmesan", "https://www.allrecipes.com/recipe/13981/eggplant-parmesan-i/", "AllRecipes", "75 min", "Medium"),
        ("Black Bean Burritos", "https://www.allrecipes.com/recipe/13954/black-bean-and-rice-burritos/", "AllRecipes", "45 min", "Easy"),
    ],
    "appetizers-party": [
        # RecipeTin Eats - verified working URLs
        ("Spinach Artichoke Dip", "https://www.recipetineats.com/spinach-and-artichoke-dip/", "RecipeTin Eats", "10 min", "Easy"),
        ("Deviled Eggs", "https://www.recipetineats.com/devilled-eggs/", "RecipeTin Eats", "45 min", "Easy"),
        ("Crispy Chicken Wings", "https://www.recipetineats.com/crispy-oven-baked-chicken-wings/", "RecipeTin Eats", "50 min", "Easy"),
        # Budget Bytes - verified working URLs
        ("Spinach Dip", "https://www.budgetbytes.com/double-spinach-artichoke-dip/", "Budget Bytes", "60 min", "Easy"),
        ("Black Bean Nachos", "https://www.budgetbytes.com/spicy-baked-black-bean-nachos/", "Budget Bytes", "25 min", "Easy"),
        # Cookie and Kate - verified working URLs
        ("Hummus", "https://cookieandkate.com/best-hummus-recipe/", "Cookie and Kate", "40 min", "Easy"),
        # AllRecipes - verified working URLs
        ("Italian Meatballs", "https://www.allrecipes.com/recipe/21353/italian-spaghetti-sauce-with-meatballs/", "AllRecipes", "140 min", "Easy"),
        ("Buffalo Chicken Dip", "https://www.allrecipes.com/recipe/68461/buffalo-chicken-dip/", "AllRecipes", "45 min", "Easy"),
        ("Guacamole", "https://www.allrecipes.com/recipe/14231/guacamole/", "AllRecipes", "10 min", "Easy"),
        ("Tzatziki Dip", "https://www.recipetineats.com/tzatziki/", "RecipeTin Eats", "10 min", "Easy"),
    ],
}


@dataclass
class Recipe:
    id: str
    slug: str
    title: str
    image: Optional[str]
    prepTime: Optional[str]
    cookTime: Optional[str]
    totalTime: Optional[str]
    servings: Optional[str]
    ingredients: list
    instructions: list
    tags: list
    source: dict
    theme: str
    difficulty: str
    addedDate: str


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    text = re.sub(r'^-+|-+$', '', text)
    return text


def decode_html_entities(text: str) -> str:
    """Decode HTML entities in text."""
    if not text:
        return text
    import html
    return html.unescape(text)


def parse_duration(duration: str) -> Optional[str]:
    """Parse ISO 8601 duration to human-readable format."""
    if not duration:
        return None

    match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration)
    if not match:
        return duration

    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)

    parts = []
    if hours:
        parts.append(f"{hours} hr{'s' if hours > 1 else ''}")
    if minutes:
        parts.append(f"{minutes} min")

    return ' '.join(parts) if parts else None


def parse_instructions(instructions) -> list:
    """Extract instructions from various formats."""
    if not instructions:
        return []

    if isinstance(instructions, str):
        return [s.strip() for s in re.split(r'\n|(?=\d+\.\s)', instructions)
                if s.strip() and not re.match(r'^\d+\.\s*$', s.strip())]

    if isinstance(instructions, list):
        result = []
        for item in instructions:
            if isinstance(item, dict):
                if item.get('@type') == 'HowToStep':
                    text = item.get('text') or item.get('name', '')
                    if text:
                        result.append(text)
                elif item.get('@type') == 'HowToSection':
                    result.extend(parse_instructions(item.get('itemListElement', [])))
                elif 'text' in item:
                    result.append(item['text'])
            elif isinstance(item, str):
                clean = re.sub(r'^\d+\.\s*', '', item).strip()
                if clean:
                    result.append(clean)
        return result

    return []


def parse_image(image) -> Optional[str]:
    """Extract image URL from various formats."""
    if not image:
        return None
    if isinstance(image, str):
        return image
    if isinstance(image, list):
        return parse_image(image[0]) if image else None
    if isinstance(image, dict):
        return image.get('url') or image.get('contentUrl')
    return None


def parse_yield(recipe_yield) -> Optional[str]:
    """Extract servings from various formats."""
    if not recipe_yield:
        return None
    if isinstance(recipe_yield, (int, float)):
        return str(int(recipe_yield))
    if isinstance(recipe_yield, str):
        # Extract just the number if it's like "4 servings"
        match = re.search(r'\d+', recipe_yield)
        return match.group() if match else recipe_yield
    if isinstance(recipe_yield, list):
        return parse_yield(recipe_yield[0]) if recipe_yield else None
    return None


def find_recipe_in_jsonld(data) -> Optional[dict]:
    """Find Recipe schema in JSON-LD data."""
    if not data:
        return None

    if isinstance(data, dict):
        if data.get('@type') == 'Recipe':
            return data
        if isinstance(data.get('@type'), list) and 'Recipe' in data['@type']:
            return data
        if '@graph' in data:
            for item in data['@graph']:
                result = find_recipe_in_jsonld(item)
                if result:
                    return result

    if isinstance(data, list):
        for item in data:
            result = find_recipe_in_jsonld(item)
            if result:
                return result

    return None


def extract_jsonld_from_html(html: str) -> list:
    """Extract all JSON-LD scripts from HTML."""
    scripts = []
    pattern = r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>'

    for match in re.finditer(pattern, html, re.DOTALL | re.IGNORECASE):
        try:
            data = json.loads(match.group(1))
            scripts.append(data)
        except json.JSONDecodeError:
            continue

    return scripts


def fetch_recipe(url: str, theme_slug: str, theme_name: str, difficulty: str = "Easy", default_tags: list = None) -> Optional[Recipe]:
    """Fetch and parse a recipe from a URL."""
    try:
        response = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        html = response.text

        # Extract JSON-LD
        jsonld_scripts = extract_jsonld_from_html(html)

        recipe_data = None
        for script in jsonld_scripts:
            recipe_data = find_recipe_in_jsonld(script)
            if recipe_data:
                break

        if not recipe_data:
            print(f"    ⚠ No recipe schema found")
            return None

        # Parse recipe data
        title = decode_html_entities(recipe_data.get('name', 'Untitled'))
        ingredients = recipe_data.get('recipeIngredient', [])
        if isinstance(ingredients, list):
            ingredients = [decode_html_entities(i) for i in ingredients if i]

        instructions = parse_instructions(recipe_data.get('recipeInstructions', []))
        instructions = [decode_html_entities(i) for i in instructions if i]

        if not ingredients and not instructions:
            print(f"    ⚠ Recipe incomplete (no ingredients or instructions)")
            return None

        # Generate slug
        slug = slugify(title)

        # Parse times
        prep_time = parse_duration(recipe_data.get('prepTime'))
        cook_time = parse_duration(recipe_data.get('cookTime'))
        total_time = parse_duration(recipe_data.get('totalTime'))

        # If no total time but we have prep and cook, calculate it
        if not total_time and (prep_time or cook_time):
            total_time = f"{prep_time or ''} {cook_time or ''}".strip()
            if total_time:
                total_time = total_time.replace("  ", " + ")

        # Parse servings
        servings = parse_yield(recipe_data.get('recipeYield'))

        # Generate tags
        tags = list(default_tags) if default_tags else []

        # Add smart tags based on content
        title_lower = title.lower()
        ingredients_text = ' '.join(ingredients).lower()

        if any(word in title_lower for word in ['chicken', 'turkey', 'duck']):
            tags.append('poultry')
        if any(word in title_lower for word in ['beef', 'steak', 'pork', 'lamb']):
            tags.append('meat')
        if any(word in title_lower for word in ['salmon', 'fish', 'shrimp', 'tuna', 'cod']):
            tags.append('seafood')
        if 'vegetarian' not in tags and not any(word in ingredients_text for word in ['chicken', 'beef', 'pork', 'fish', 'shrimp', 'bacon', 'meat']):
            tags.append('vegetarian')
        if any(word in title_lower for word in ['soup', 'stew', 'chowder']):
            tags.append('soup')
        if any(word in title_lower for word in ['salad']):
            tags.append('salad')
        if any(word in title_lower for word in ['pasta', 'spaghetti', 'lasagna']):
            tags.append('pasta')

        # Dedupe tags
        tags = list(dict.fromkeys(tags))[:8]

        # Get source info
        parsed_url = urlparse(url)
        source_name = parsed_url.netloc.replace('www.', '').split('.')[0].title()

        # Get image
        image_url = parse_image(recipe_data.get('image'))

        recipe = Recipe(
            id=slug,
            slug=slug,
            title=title,
            image=image_url,
            prepTime=prep_time,
            cookTime=cook_time,
            totalTime=total_time,
            servings=servings,
            ingredients=ingredients,
            instructions=instructions,
            tags=tags,
            source={"name": source_name, "url": url},
            theme=theme_name,
            difficulty=difficulty,
            addedDate=datetime.utcnow().isoformat() + "Z"
        )

        return recipe

    except requests.RequestException as e:
        print(f"    ⚠ Network error: {e}")
        return None
    except Exception as e:
        print(f"    ⚠ Error: {e}")
        return None


def collect_theme_recipes(theme_slug: str, theme_config: dict) -> list:
    """Collect all recipes for a theme."""
    print(f"\n{'='*60}")
    print(f"📚 {theme_config['name']}")
    print(f"   {theme_config['description']}")
    print(f"{'='*60}")

    recipes = []
    curated = CURATED_RECIPES.get(theme_slug, [])

    for i, (title, url, source, est_time, difficulty) in enumerate(curated):
        if len(recipes) >= theme_config['count']:
            break

        print(f"\n[{i+1}/{len(curated)}] {title}")
        print(f"    Source: {source} | Est. time: {est_time}")

        recipe = fetch_recipe(
            url=url,
            theme_slug=theme_slug,
            theme_name=theme_config['name'],
            difficulty=difficulty,
            default_tags=theme_config['tags_default']
        )

        if recipe:
            recipes.append(recipe)
            print(f"    ✓ Extracted: {len(recipe.ingredients)} ingredients, {len(recipe.instructions)} steps")
        else:
            print(f"    ✗ Failed to extract")

        # Rate limiting
        if i < len(curated) - 1:
            time.sleep(DELAY_BETWEEN_REQUESTS)

    return recipes


def save_theme_json(theme_slug: str, theme_config: dict, recipes: list):
    """Save recipes to a theme-specific JSON file."""
    output = {
        "theme": {
            "slug": theme_slug,
            "name": theme_config['name'],
            "description": theme_config['description'],
        },
        "metadata": {
            "recipeCount": len(recipes),
            "lastUpdated": datetime.utcnow().isoformat() + "Z",
        },
        "recipes": [asdict(r) for r in recipes]
    }

    filepath = os.path.join(OUTPUT_DIR, f"{theme_slug}.json")
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"  💾 Saved to {filepath}")


def save_master_json(all_recipes: dict):
    """Save master JSON with all collections."""
    collections = []
    all_recipes_flat = []

    for theme_slug, data in all_recipes.items():
        theme_config = THEMES[theme_slug]
        collections.append({
            "slug": theme_slug,
            "name": theme_config['name'],
            "description": theme_config['description'],
            "recipeCount": len(data['recipes']),
            "recipes": [r.slug for r in data['recipes']]
        })
        all_recipes_flat.extend(data['recipes'])

    output = {
        "metadata": {
            "totalRecipes": len(all_recipes_flat),
            "collectionCount": len(collections),
            "lastUpdated": datetime.utcnow().isoformat() + "Z",
        },
        "collections": collections,
        "recipes": [asdict(r) for r in all_recipes_flat]
    }

    filepath = os.path.join(OUTPUT_DIR, "all-recipes.json")
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n💾 Master file saved to {filepath}")


def main():
    """Main entry point."""
    print("\n" + "="*60)
    print("🍳 SIMPLER RECIPES - Collection Builder")
    print("="*60)

    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    all_recipes = {}
    total_success = 0
    total_attempted = 0

    for theme_slug, theme_config in THEMES.items():
        recipes = collect_theme_recipes(theme_slug, theme_config)
        all_recipes[theme_slug] = {'config': theme_config, 'recipes': recipes}

        total_attempted += theme_config['count']
        total_success += len(recipes)

        # Save individual theme file
        print(f"\n📊 {theme_config['name']}: {len(recipes)}/{theme_config['count']} recipes")
        save_theme_json(theme_slug, theme_config, recipes)

    # Save master file
    save_master_json(all_recipes)

    # Print summary
    print("\n" + "="*60)
    print("📊 COLLECTION COMPLETE")
    print("="*60)
    print(f"Total recipes collected: {total_success}")
    print(f"Success rate: {total_success/total_attempted*100:.1f}%")
    print(f"\nFiles created in {OUTPUT_DIR}:")
    for theme_slug in THEMES:
        print(f"  • {theme_slug}.json")
    print(f"  • all-recipes.json (master index)")
    print("\n✅ Done!")


if __name__ == "__main__":
    main()
