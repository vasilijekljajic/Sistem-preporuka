import DataExtraction
import pandas as pd
import numpy as np
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rules_df = DataExtraction.rules
rules_df["antecedents"] = rules_df["antecedents"].apply(lambda x: set(map(int, x.replace("frozenset({", "").replace("})", "").split(", "))))
rules_df["consequents"] = rules_df["consequents"].apply(lambda x: set(map(int, x.replace("frozenset({", "").replace("})", "").split(", "))))

np.random.seed(42)
all_products_list = list(set().union(*rules_df["consequents"]))
margins_mapping = {pid: round(np.random.uniform(0.05, 0.30), 2) for pid in all_products_list}

products_df = DataExtraction.products
product_names = dict(zip(products_df["product_id"], products_df["product_name"]))

model = DataExtraction.als_model
mappings = DataExtraction.mappings


def get_fp_recommendations(cart_set: set, min_lift: float, min_margin: float = 0.05):
    candidates = []
    
    for _, row in rules_df.iterrows():
        matches = row["antecedents"].intersection(cart_set)
        if matches and row["lift"] >= min_lift:
            for item in row["consequents"]:
                if item not in cart_set and margins_mapping.get(item, 0) >= min_margin:
                    names = [product_names.get(x, f"Product {x}") for x in row["antecedents"]]
                    
                    if len(names) > 1:
                        antecedents_str = " i ".join([", ".join(names[:-1]), names[-1]])
                    else:
                        antecedents_str = names[0]
                        
                    consequent_str = product_names.get(item, f"Product {item}")
                    percentage = int(row["confidence"] * 100)
                    explanation_msg = f"Kupci koji uzmu {antecedents_str} kupe i ovaj proizvod u {percentage} % slučajeva"
                    
                    candidates.append({
                        "product_id": int(item),
                        "product_name": consequent_str,
                        "score": float(row["confidence"]),
                        "source": "fpgrowth",
                        "explanation": explanation_msg
                    })
    return candidates


def get_als_recommendations(cart_list: list, n_recommendations=5):
    if model is None or "item_map" not in mappings:
        return []

    item_map = mappings["item_map"]
    candidates = []
    
    try:
        for pid in cart_list:
            if pid in item_map.cat.categories:
                internal_id = item_map.cat.categories.get_loc(pid)
                ids, scores = model.similar_items(itemid=internal_id, N=n_recommendations + 3)
                
                for idx, score in zip(ids, scores):
                    real_id = item_map.cat.categories[idx]
                    if real_id not in cart_list:
                        candidates.append({
                            "product_id": int(real_id),
                            "product_name": product_names.get(real_id, f"Product {real_id}"),
                            "score": float(score) * 0.5,
                            "source": "als",
                            "explanation": f"Korisnici koji kupe {product_names.get(pid, f'Product {pid}')} kupe i ovaj proizvod u {int(score*100)} % slučajeva."
                        })
        return candidates
    except:
        return []


def apply_mmr(candidates: list, lambda_param: float, top_n=5):
    if not candidates:
        return []
        
    selected = [candidates[0]]
    remaining = candidates[1:]
    
    while len(selected) < top_n and remaining:
        best_item = None
        best_score = -999.0
        
        for item in remaining:
            duplicate_penalty = max([1.0 if s["source"] == item["source"] else 0.0 for s in selected])
            mmr_score = lambda_param * item["score"] - (1 - lambda_param) * duplicate_penalty
            
            if mmr_score > best_score:
                best_score = mmr_score
                best_item = item
                
        if best_item:
            selected.append(best_item)
            remaining.remove(best_item)
        else:
            break
            
    return selected


class CartRequest(BaseModel):
    cart: List[int]
    top_n: int = 5
    lift_threshold: float = 1.0
    mmr_lambda: float = 0.7


@app.post("/recommend")
def recommend(data: CartRequest):
    cart_set = set(data.cart)
    
    fp_items = get_fp_recommendations(cart_set, data.lift_threshold, min_margin=0.0)
    als_items = get_als_recommendations(data.cart, data.top_n)
    
    all_items = sorted(fp_items + als_items, key=lambda x: x["score"], reverse=True)
    
    unique_items = []
    seen = set()
    for item in all_items:
        if item["product_id"] not in seen:
            seen.add(item["product_id"])
            unique_items.append(item)
            
    return {"recommendations": apply_mmr(unique_items, data.mmr_lambda, data.top_n)}


@app.get("/products/search")
def search_products(q: str = "", limit: int = 10):
    if not q:
        return {"products": []}
        
    results = products_df[products_df["product_name"].str.contains(q, case=False, na=False)].head(limit)
    
    output = []
    for _, row in results.iterrows():
        output.append({
            "product_id": int(row["product_id"]),
            "product_name": str(row["product_name"])
        })
    return {"products": output}


@app.get("/rules")
def get_rules_table(min_lift: float = 1.0, limit: int = 50):
    filtered = rules_df[rules_df["lift"] >= min_lift].head(limit)
    output = []
    
    for _, row in filtered.iterrows():
        for ant in row["antecedents"]:
            for cons in row["consequents"]:
                output.append({
                    "antecedents": [ant],
                    "consequents": [cons],
                    "antecedent_names": [product_names.get(ant, f"Product {ant}")],
                    "consequent_names": [product_names.get(cons, f"Product {cons}")],
                    "support": float(row["support"]),
                    "confidence": float(row["confidence"]),
                    "lift": float(row["lift"])
                })
    return {"rules": output}


app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")