"""
Trae datos de mercado que no se pueden consumir desde el browser por CORS
(Yahoo Finance) y los guarda como JSON local en data/.

Uso:
    python fetch_mercados.py

Pensado para correr en GitHub Actions junto con subir_datos.py.
"""
import sys
import json
import os
import datetime
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

OUTPUT_DIR = 'data'
os.makedirs(OUTPUT_DIR, exist_ok=True)


def fetch_yahoo(symbol, nombre, rango='5y', factor=1.0):
    """
    Descarga precios de cierre diarios desde Yahoo Finance.
    factor: multiplicador para convertir unidades (ej. centavos→USD, bushels→toneladas).
    """
    print(f"Trayendo {nombre} ({symbol}) desde Yahoo Finance...")
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        f"?interval=1d&range={rango}"
    )
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        data = json.loads(urllib.request.urlopen(req, timeout=20).read())
        result = data['chart']['result'][0]
        timestamps = result['timestamp']
        closes = result['indicators']['quote'][0]['close']
        registros = [
            {
                'fecha': datetime.datetime.fromtimestamp(
                    t, datetime.timezone.utc
                ).strftime('%Y-%m-%d'),
                'valor': round(c * factor, 2),
            }
            for t, c in zip(timestamps, closes)
            if c is not None
        ]
        ruta = os.path.join(OUTPUT_DIR, f'{nombre}.json')
        # Se fusiona con lo que ya hay: si Yahoo devuelve una respuesta parcial
        # (pasó con ^MERV en nov-2026: 1 solo punto), no se pierde el historial.
        previos = []
        if os.path.exists(ruta):
            with open(ruta, encoding='utf-8') as f:
                previos = json.load(f)
        por_fecha = {r['fecha']: r for r in previos}
        por_fecha.update({r['fecha']: r for r in registros})
        fusion = [por_fecha[k] for k in sorted(por_fecha)]
        with open(ruta, 'w', encoding='utf-8') as f:
            json.dump(fusion, f, ensure_ascii=False, indent=2)
        print(f"✅ {len(registros)} registros nuevos, {len(fusion)} en total en {ruta}")
        # Si la fuente no trajo nada de la última semana, está rota: que el workflow falle.
        ultimo = max((r['fecha'] for r in registros), default='')
        limite = (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
        if ultimo < limite:
            print(f"❌ {nombre}: el último dato de Yahoo es {ultimo or 'ninguno'} (anterior a {limite})")
            return False
        return True
    except Exception as e:
        print(f"❌ Error al traer {nombre}: {e}")
        return False


if __name__ == "__main__":
    resultados = [
        # ^MERV = índice Merval (Bolsa de Buenos Aires)
        fetch_yahoo('%5EMERV', 'merval'),
        # GC=F = futuro de oro COMEX (USD/oz)
        fetch_yahoo('GC%3DF', 'oro', rango='5y'),
        # ZS=F = futuro de soja CBOT (cotiza en centavos/bushel)
        # factor = 36.7437 / 100 convierte centavos/bushel → USD/tonelada métrica
        fetch_yahoo('ZS%3DF', 'soja', rango='5y', factor=36.7437 / 100),
        # CL=F = futuro de petróleo WTI NYMEX (USD/barril)
        fetch_yahoo('CL%3DF', 'wti', rango='5y'),
        # BZ=F = futuro de petróleo Brent ICE (USD/barril)
        fetch_yahoo('BZ%3DF', 'brent', rango='5y'),
    ]
    # Código de salida != 0 si alguna serie falló, para que el workflow lo marque
    # (después de guardar las que sí anduvieron).
    sys.exit(0 if all(resultados) else 1)
