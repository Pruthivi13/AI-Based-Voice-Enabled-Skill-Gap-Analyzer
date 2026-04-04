import json
import os
from dotenv import load_dotenv
from groq import Groq
from utils.logger import setup_logger

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../backend/.env'))

logger = setup_logger(__name__)
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ─────────────────────────────────────────────────────────────────────────────
# roadmap.sh style: LEFT-TO-RIGHT flow
#
# Node type hierarchy (mirrors roadmap.sh visual language):
#   root      → the role title (one node, leftmost)
#   main      → major topic areas (e.g. "Core Foundations", "Databases")
#   subtopic  → categories under a main node (e.g. "SQL", "NoSQL")
#   leaf      → individual skills/tools (e.g. "PostgreSQL", "MongoDB")
#   optional  → nice-to-have skills (purple tint)
#   focus     → weak areas from interview (red, priority attention)
#
# Dagre handles ALL positioning — backend just needs correct types + edges.
# ─────────────────────────────────────────────────────────────────────────────

VALID_TYPES = {"root", "main", "subtopic", "leaf", "optional", "focus"}

EDGE_TYPE_MAP = {
    # source_type → target_type → edgeType
    ("root",     "main"):     "spine",
    ("main",     "main"):     "spine",
    ("main",     "subtopic"): "branch",
    ("main",     "leaf"):     "branch",
    ("main",     "focus"):    "focus",
    ("main",     "optional"): "optional",
    ("subtopic", "leaf"):     "branch",
    ("subtopic", "optional"): "optional",
    ("subtopic", "focus"):    "focus",
}


def _infer_edge_type(src_type: str, tgt_type: str) -> str:
    return EDGE_TYPE_MAP.get((src_type, tgt_type), "branch")


def generate_roadmap(target_role: str, weak_skills: list) -> dict:
    logger.info(f"Generating roadmap.sh style roadmap for: {target_role}")
    weak_skills_str = ", ".join(weak_skills) if weak_skills else "none"

    prompt = f"""
You are generating a detailed learning roadmap in the style of roadmap.sh for the role: "{target_role}".

Weak/focus skills (mark these nodes as type "focus"): {weak_skills_str}

Return a JSON object with "nodes" and "edges" arrays.

━━━ NODE TYPES (use EXACTLY these strings) ━━━
- "root"     : Single role title node. id must be "root". ONE only.
- "main"     : Major topic areas (5-7 nodes). These are the primary learning stages.
- "subtopic" : A category or sub-area under a main node (2-4 per main).
- "leaf"     : Individual skill, tool, or concept under a subtopic (2-5 per subtopic).
- "optional" : Nice-to-have / alternative skill (purple). Use sparingly.
- "focus"    : Weak area from interview that needs priority attention (red). 
               Use for nodes matching: {weak_skills_str}

━━━ STRUCTURE (follow this hierarchy) ━━━
root → main → subtopic → leaf
                       → optional (alternative tools)
             → focus   (weak area, branches off main)

━━━ RULES ━━━
1. Generate a RICH, DETAILED roadmap — aim for 40-60 total nodes
2. Each main node should have 2-4 subtopics
3. Each subtopic should have 2-4 leaf nodes (real tools/skills/concepts)
4. Add 3-6 "optional" nodes for alternative tools the user can pick
5. Add "focus" nodes for any skill matching: {weak_skills_str}
6. Positions don't matter — set all x=0, y=0. Frontend uses Dagre auto-layout.
7. Do NOT use parentId or extent — these are flat nodes connected only by edges

━━━ NODE DATA (required fields for every node) ━━━
- label: string (keep concise, max 4 words)
- isWeak: boolean (true if matches weak skills)  
- description: "1-2 sentences about this skill"
- timeToLearn: "X days/weeks/months"
- priority: "High" / "Medium" / "Low"
- resources: array of 2-3 items, each: {{type, title, url}}
  (type = "Course" / "Article" / "Video" / "Book")

━━━ EDGE TYPES ━━━
- "spine"    : root→main, main→main connections (blue solid)
- "branch"   : main→subtopic, subtopic→leaf (grey dashed)
- "focus"    : connections to focus nodes (red dashed)
- "optional" : connections to optional nodes (purple dashed)

━━━ EXAMPLE (abbreviated) ━━━
{{
  "nodes": [
    {{"id":"root","type":"root","position":{{"x":0,"y":0}},"data":{{"label":"{target_role}","isWeak":false,"description":"Complete learning roadmap.","timeToLearn":"-","priority":"High","resources":[]}}}},
    {{"id":"m1","type":"main","position":{{"x":0,"y":0}},"data":{{"label":"Core Foundations","isWeak":false,"description":"Essential programming fundamentals.","timeToLearn":"4-6 weeks","priority":"High","resources":[{{"type":"Course","title":"CS50","url":"https://cs50.harvard.edu"}}]}}}},
    {{"id":"m1-s1","type":"subtopic","position":{{"x":0,"y":0}},"data":{{"label":"Programming Languages","isWeak":false,"description":"Core languages for the role.","timeToLearn":"3-4 weeks","priority":"High","resources":[]}}}},
    {{"id":"m1-s1-l1","type":"leaf","position":{{"x":0,"y":0}},"data":{{"label":"Python","isWeak":false,"description":"Primary language for this role.","timeToLearn":"2-3 weeks","priority":"High","resources":[{{"type":"Course","title":"Python for Everybody","url":"https://py4e.com"}}]}}}},
    {{"id":"m1-s1-l2","type":"leaf","position":{{"x":0,"y":0}},"data":{{"label":"TypeScript","isWeak":false,"description":"Typed JavaScript superset.","timeToLearn":"1-2 weeks","priority":"Medium","resources":[]}}}},
    {{"id":"m1-s1-opt1","type":"optional","position":{{"x":0,"y":0}},"data":{{"label":"Go","isWeak":false,"description":"Alternative systems language.","timeToLearn":"3 weeks","priority":"Low","resources":[]}}}},
    {{"id":"focus-1","type":"focus","position":{{"x":0,"y":0}},"data":{{"label":"Communication","isWeak":true,"description":"Focus area from your interview.","timeToLearn":"2-4 weeks","priority":"High","resources":[]}}}}
  ],
  "edges": [
    {{"id":"e-root-m1","source":"root","target":"m1","edgeType":"spine"}},
    {{"id":"e-m1-s1","source":"m1","target":"m1-s1","edgeType":"branch"}},
    {{"id":"e-m1-s1-l1","source":"m1-s1","target":"m1-s1-l1","edgeType":"branch"}},
    {{"id":"e-m1-s1-l2","source":"m1-s1","target":"m1-s1-l2","edgeType":"branch"}},
    {{"id":"e-m1-s1-opt1","source":"m1-s1","target":"m1-s1-opt1","edgeType":"optional"}},
    {{"id":"e-m1-focus1","source":"m1","target":"focus-1","edgeType":"focus"}}
  ]
}}

Now generate the COMPLETE detailed roadmap for "{target_role}".
Make it as rich and detailed as roadmap.sh — include real tool names, frameworks, concepts.
Return ONLY valid JSON. No explanation.
"""

    models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"]
    response = None
    for model_name in models:
        try:
            logger.info(f"Trying: {model_name}")
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You generate detailed roadmap.sh style learning roadmaps as JSON. Return only a valid JSON object. No markdown, no explanation."},
                    {"role": "user",   "content": prompt},
                ],
                temperature=0.3,
                max_tokens=6000,
                response_format={"type": "json_object"},
            )
            logger.info(f"Success: {model_name}")
            break
        except Exception as err:
            logger.warning(f"{model_name} failed: {err}")

    if response is None:
        logger.error("All models failed — using fallback")
        return _build_fallback_roadmap(target_role, weak_skills)

    try:
        raw = response.choices[0].message.content.strip()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            import re
            m = re.search(r'\{.*\}', raw, re.DOTALL)
            if not m:
                raise Exception("No JSON found")
            data = json.loads(m.group())

        if "nodes" not in data or "edges" not in data:
            raise Exception("Missing nodes or edges")

        # Build type lookup for edge inference
        type_by_id = {}

        sanitized_nodes = []
        for n in data["nodes"]:
            nd = n.get("data", {})
            resources = nd.get("resources", [])
            if not isinstance(resources, list):
                resources = []

            node_type = str(n.get("type", "leaf"))
            if node_type not in VALID_TYPES:
                node_type = "leaf"

            node = {
                "id":   str(n.get("id", "")),
                "type": node_type,
                "position": {"x": 0, "y": 0},  # Dagre handles positions
                "data": {
                    "label":       str(nd.get("label", ""))[:40],
                    "isWeak":      bool(nd.get("isWeak", False)) or node_type == "focus",
                    "description": str(nd.get("description", "")),
                    "timeToLearn": str(nd.get("timeToLearn", "1-2 weeks")),
                    "priority":    str(nd.get("priority", "Medium")),
                    "resources": [
                        {
                            "type":  str(r.get("type", "Resource")),
                            "title": str(r.get("title", "")),
                            "url":   str(r.get("url", "#")),
                        }
                        for r in resources[:3]
                    ],
                },
            }
            type_by_id[node["id"]] = node_type
            sanitized_nodes.append(node)

        sanitized_edges = []
        seen_edges = set()
        for e in data["edges"]:
            src = str(e.get("source", ""))
            tgt = str(e.get("target", ""))
            key = f"{src}->{tgt}"
            if key in seen_edges:
                continue
            seen_edges.add(key)

            # Infer edge type from node types if not provided
            provided = str(e.get("edgeType", ""))
            src_type = type_by_id.get(src, "leaf")
            tgt_type = type_by_id.get(tgt, "leaf")
            edge_type = provided if provided in ("spine","branch","focus","optional") else _infer_edge_type(src_type, tgt_type)

            sanitized_edges.append({
                "id":       str(e.get("id", f"e-{src}-{tgt}")),
                "source":   src,
                "target":   tgt,
                "edgeType": edge_type,
            })

        # Ensure root→first main edge exists
        root_exists  = any(n["id"] == "root" for n in sanitized_nodes)
        has_root_edge = any(e["source"] == "root" for e in sanitized_edges)
        if root_exists and not has_root_edge:
            main_nodes = [n for n in sanitized_nodes if n["type"] == "main"]
            if main_nodes:
                sanitized_edges.insert(0, {
                    "id": "e-root-m1-auto",
                    "source": "root",
                    "target": main_nodes[0]["id"],
                    "edgeType": "spine",
                })

        logger.info(f"Roadmap ready: {len(sanitized_nodes)} nodes, {len(sanitized_edges)} edges")
        return {"nodes": sanitized_nodes, "edges": sanitized_edges}

    except Exception as e:
        logger.error(f"Processing failed: {e} — using fallback")
        return _build_fallback_roadmap(target_role, weak_skills)


def _build_fallback_roadmap(target_role: str, weak_skills: list) -> dict:
    """Detailed deterministic fallback in roadmap.sh style."""
    weak_set = {s.lower() for s in (weak_skills or [])}

    def iw(label: str) -> bool:
        return any(w in label.lower() for w in weak_set)

    def node(nid, ntype, label, desc="", time="1-2 weeks", priority="Medium", resources=None):
        return {
            "id": nid, "type": ntype,
            "position": {"x": 0, "y": 0},
            "data": {
                "label": label,
                "isWeak": iw(label) or ntype == "focus",
                "description": desc or f"Learn {label} for {target_role}.",
                "timeToLearn": time,
                "priority": priority,
                "resources": resources or [],
            },
        }

    def edge(eid, src, tgt, etype="branch"):
        return {"id": eid, "source": src, "target": tgt, "edgeType": etype}

    nodes = [
        node("root", "root", target_role, f"Complete roadmap for {target_role}.", "6-12 months", "High"),

        # Stage 1
        node("m1", "main", "Core Foundations", "Essential programming and CS fundamentals.", "4-8 weeks", "High"),
        node("m1-s1", "subtopic", "Programming Languages", "Core languages for the role.", "3-4 weeks", "High"),
        node("m1-s1-l1", "leaf", "Primary Language", "The main language for this role.", "2-3 weeks", "High"),
        node("m1-s1-l2", "leaf", "Secondary Language", "Supporting language skills.", "1-2 weeks", "Medium"),
        node("m1-s2", "subtopic", "Version Control", "Code versioning and collaboration.", "1 week", "High"),
        node("m1-s2-l1", "leaf", "Git", "Most widely used version control.", "3-5 days", "High"),
        node("m1-s2-l2", "leaf", "GitHub / GitLab", "Remote repository platforms.", "2-3 days", "High"),

        # Stage 2
        node("m2", "main", "Domain Knowledge", "Core domain skills and tools.", "6-10 weeks", "High"),
        node("m2-s1", "subtopic", "Core Frameworks", "Primary frameworks for the role.", "4-6 weeks", "High"),
        node("m2-s1-l1", "leaf", "Main Framework", "The primary framework used.", "3-4 weeks", "High"),
        node("m2-s1-l2", "leaf", "Supporting Tools", "Tools that complement the framework.", "1-2 weeks", "Medium"),
        node("m2-s1-opt1", "optional", "Alternative Framework", "An alternative worth knowing.", "2-3 weeks", "Low"),
        node("m2-s2", "subtopic", "Data & Storage", "Working with data and databases.", "2-3 weeks", "High"),
        node("m2-s2-l1", "leaf", "SQL Databases", "Relational database fundamentals.", "1-2 weeks", "High"),
        node("m2-s2-l2", "leaf", "NoSQL Databases", "Document/key-value stores.", "1 week", "Medium"),

        # Stage 3
        node("m3", "main", "System Design", "Architecture and design patterns.", "4-6 weeks", "High"),
        node("m3-s1", "subtopic", "Design Patterns", "Common software design patterns.", "2-3 weeks", "High"),
        node("m3-s1-l1", "leaf", "MVC / MVVM", "Model-View patterns.", "3-5 days", "High"),
        node("m3-s1-l2", "leaf", "SOLID Principles", "Object-oriented design principles.", "1 week", "High"),
        node("m3-s2", "subtopic", "APIs & Integration", "Building and consuming APIs.", "2-3 weeks", "High"),
        node("m3-s2-l1", "leaf", "REST APIs", "RESTful API design.", "1 week", "High"),
        node("m3-s2-l2", "leaf", "GraphQL", "Query language for APIs.", "1 week", "Medium"),
        node("m3-s2-opt1", "optional", "gRPC", "High-performance RPC framework.", "1 week", "Low"),

        # Stage 4
        node("m4", "main", "Testing & Quality", "Ensuring code quality and reliability.", "2-3 weeks", "High"),
        node("m4-s1", "subtopic", "Testing Strategies", "Different levels of testing.", "1-2 weeks", "High"),
        node("m4-s1-l1", "leaf", "Unit Testing", "Testing individual components.", "1 week", "High"),
        node("m4-s1-l2", "leaf", "Integration Testing", "Testing component interactions.", "3-5 days", "High"),
        node("m4-s1-l3", "leaf", "E2E Testing", "End-to-end user flow testing.", "3-5 days", "Medium"),

        # Stage 5
        node("m5", "main", "Deployment & DevOps", "Shipping and maintaining software.", "3-4 weeks", "Medium"),
        node("m5-s1", "subtopic", "CI/CD", "Continuous integration and delivery.", "1-2 weeks", "High"),
        node("m5-s1-l1", "leaf", "GitHub Actions", "Automated workflows.", "3-5 days", "High"),
        node("m5-s1-l2", "leaf", "Docker", "Containerization.", "1 week", "High"),
        node("m5-s1-opt1", "optional", "Kubernetes", "Container orchestration.", "2 weeks", "Low"),
        node("m5-s2", "subtopic", "Cloud Platforms", "Cloud hosting and services.", "1-2 weeks", "Medium"),
        node("m5-s2-l1", "leaf", "AWS / GCP / Azure", "Major cloud providers.", "1-2 weeks", "Medium"),
    ]

    # Add focus nodes for weak skills
    for i, skill in enumerate(weak_skills[:4]):
        nodes.append(node(f"focus-{i}", "focus", skill, f"Priority focus area from your interview.", "2-4 weeks", "High"))

    edges = [
        edge("e-root-m1", "root", "m1", "spine"),
        edge("e-m1-m2", "m1", "m2", "spine"),
        edge("e-m2-m3", "m2", "m3", "spine"),
        edge("e-m3-m4", "m3", "m4", "spine"),
        edge("e-m4-m5", "m4", "m5", "spine"),

        edge("e-m1-s1", "m1", "m1-s1"), edge("e-m1-s2", "m1", "m1-s2"),
        edge("e-m1-s1-l1", "m1-s1", "m1-s1-l1"), edge("e-m1-s1-l2", "m1-s1", "m1-s1-l2"),
        edge("e-m1-s2-l1", "m1-s2", "m1-s2-l1"), edge("e-m1-s2-l2", "m1-s2", "m1-s2-l2"),

        edge("e-m2-s1", "m2", "m2-s1"), edge("e-m2-s2", "m2", "m2-s2"),
        edge("e-m2-s1-l1", "m2-s1", "m2-s1-l1"), edge("e-m2-s1-l2", "m2-s1", "m2-s1-l2"),
        edge("e-m2-s1-opt1", "m2-s1", "m2-s1-opt1", "optional"),
        edge("e-m2-s2-l1", "m2-s2", "m2-s2-l1"), edge("e-m2-s2-l2", "m2-s2", "m2-s2-l2"),

        edge("e-m3-s1", "m3", "m3-s1"), edge("e-m3-s2", "m3", "m3-s2"),
        edge("e-m3-s1-l1", "m3-s1", "m3-s1-l1"), edge("e-m3-s1-l2", "m3-s1", "m3-s1-l2"),
        edge("e-m3-s2-l1", "m3-s2", "m3-s2-l1"), edge("e-m3-s2-l2", "m3-s2", "m3-s2-l2"),
        edge("e-m3-s2-opt1", "m3-s2", "m3-s2-opt1", "optional"),

        edge("e-m4-s1", "m4", "m4-s1"),
        edge("e-m4-s1-l1", "m4-s1", "m4-s1-l1"), edge("e-m4-s1-l2", "m4-s1", "m4-s1-l2"),
        edge("e-m4-s1-l3", "m4-s1", "m4-s1-l3"),

        edge("e-m5-s1", "m5", "m5-s1"), edge("e-m5-s2", "m5", "m5-s2"),
        edge("e-m5-s1-l1", "m5-s1", "m5-s1-l1"), edge("e-m5-s1-l2", "m5-s1", "m5-s1-l2"),
        edge("e-m5-s1-opt1", "m5-s1", "m5-s1-opt1", "optional"),
        edge("e-m5-s2-l1", "m5-s2", "m5-s2-l1"),
    ]

    # Connect focus nodes to nearest main
    for i in range(min(len(weak_skills), 4)):
        main_id = f"m{(i % 4) + 1}"
        edges.append(edge(f"e-focus-{i}", main_id, f"focus-{i}", "focus"))

    return {"nodes": nodes, "edges": edges}


def generate_node_info(skill_label: str, target_role: str) -> dict:
    logger.info(f"Node info: {skill_label}")
    prompt = f"""Generate detailed learning info for "{skill_label}" for a "{target_role}".
Return JSON: description (3-4 sentences), whatYouWillLearn (4 bullet strings),
resources (3-4 items: {{type, title, url, free}}), timeToLearn, difficulty, prerequisites (array).
Return ONLY valid JSON."""
    models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"]
    for model_name in models:
        try:
            r = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "Return only valid JSON."},
                    {"role": "user",   "content": prompt},
                ],
                temperature=0.3, max_tokens=1000,
                response_format={"type": "json_object"},
            )
            return json.loads(r.choices[0].message.content.strip())
        except Exception as err:
            logger.warning(f"Node info {model_name} failed: {err}")
    raise Exception("All models failed for node info")