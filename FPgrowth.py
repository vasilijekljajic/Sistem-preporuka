import DataExtraction as data
import pandas as pd

from mlxtend.preprocessing import TransactionEncoder
from mlxtend.frequent_patterns import fpgrowth, association_rules


df = data.order_products_prior

top_products = df["product_id"].value_counts().head(2000).index
df = df[df["product_id"].isin(top_products)]

transactions = df.groupby("order_id")["product_id"].apply(list)

te = TransactionEncoder()
df_fp = pd.DataFrame(te.fit(transactions).transform(transactions),columns=te.columns_)

freq_items = fpgrowth(df_fp, min_support=0.005, use_colnames=True)

rules = association_rules(freq_items, metric="confidence", min_threshold=0.1)

# print(rules[["antecedents","consequents","support","confidence","lift"]].head(10))
rules.sort_values("lift",ascending=False)

rules.to_csv("rules.csv", index=False)