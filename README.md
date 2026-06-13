# Market Basket Recommender App

Ovo je projekat za sistem preporuka koji koristi:

- FP-Growth za asocijativna pravila
- ALS za slične proizvode
- FastAPI backend
- frontend u `frontend/` folderu

## Šta radi

- Backend učitava pravila iz `data/FPgrowth/rules.csv`
- Backend učitava ALS model iz `data/ALS/model.pkl`
- Frontend traži proizvode i šalje korpu backendu za preporuke
- Prikazuje hibridne preporuke iz FP-Growth i ALS modela

## Potrebno

- Python 3.9+ (preporučeno)
- `data/` direktorijum sa:
  - `orders.csv`
  - `products.csv`
  - `order_products__prior.csv`
  - `order_products__train.csv`
  - `data/FPgrowth/rules.csv`
  - `data/ALS/model.pkl`
  - `data/ALS/matrix.pkl`
  - `data/ALS/mappings.pkl`

> Ako dataset i modeli nisu tu, prvo treba ubaciti odgovarajuće CSV fajlove i pokrenuti `FPgrowth.py` i `ALS.py` da bi se generisao model.

## Instalacija

1. Otvoriti terminal u folderu projekta
2. Napraviti virtualno okruženje (opciono):

```powershell
python -m venv venv
venv\Scripts\Activate.ps1
```

3. Instalirati zavisnosti:

```powershell
pip install -r requirements.txt
```

## Pokretanje

1. U terminalu pokrenuti backend:

```powershell
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

2. Otvoriti u browseru:

```text
http://localhost:8000
```

3. Na stranici pretraži proizvode, dodaj ih u korpu i klikni `Generiši preporuke`.

## Za regeneraciju pravila ili modela

- `python FPgrowth.py` -> generiše `rules.csv`
- `python ALS.py` -> generiše `data/ALS/model.pkl`, `matrix.pkl` i `mappings.pkl`
