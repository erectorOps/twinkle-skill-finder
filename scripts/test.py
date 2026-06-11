import json
from pathlib import Path

# type_map.json
with open("../SkillParser/rules/type_map.json", encoding="utf-8") as f:
    type_map = json.load(f)

# skills.json
with open("public/data/skills.json", encoding="utf-8") as f:
    skills = json.load(f)

# type一覧取得
types = sorted({
    effect["type"]
    for skill in skills
    for effect in skill["effects"]
})

print("const effectTypes = [")

for type_name in types:
    klass = type_map.get(type_name, "")

    print(
        f'  {{ "id": "", "label": "{type_name}", "klass": "{klass}" }},'
    )

print("];")