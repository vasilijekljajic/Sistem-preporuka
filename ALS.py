import DataExtraction as data
import pandas as pd
from scipy.sparse import coo_matrix
import numpy as np
from implicit.als import AlternatingLeastSquares
import pickle



df = data.order_products_prior

top_products = df["product_id"].value_counts().head(2000).index
df = df[df["product_id"].isin(top_products)]



user_codes = df["order_id"].astype("category")
item_codes = df["product_id"].astype("category")

user_ids = user_codes.cat.codes
item_ids = item_codes.cat.codes

values = np.ones(len(df))

matrix = coo_matrix((values, (user_ids, item_ids)))
matrix = matrix.tocsr()

model = AlternatingLeastSquares(
    factors=50,
    iterations=20
)

model.fit(matrix)

with open("data/ALS/model.pkl", "wb") as f:
    pickle.dump(model, f)

with open("data/ALS/matrix.pkl", "wb") as f:
    pickle.dump(matrix, f)

with open("data/ALS/mappings.pkl", "wb") as f:
    pickle.dump({
        "user_map": user_codes,
        "item_map": item_codes
    }, f)