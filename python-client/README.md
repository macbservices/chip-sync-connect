# Mac Chip - Cliente Local

Aplicação Python que lê dados dos modems GSM via porta serial e envia para o dashboard web.

## Instalação

```bash
cd python-client
pip install -r requirements.txt
```

## Configuração

1. Acesse o dashboard web e faça login
2. Crie uma **Localização** e copie a **API Key** gerada
3. Na primeira execução, o app pedirá a API Key e salvará no `config.json`

## Executar

```bash
python mac-chip.py
```

## Compilar para .exe (com ícone)

```bash
pip install pyinstaller pillow
```

Primeiro converta o ícone PNG para ICO:
```python
from PIL import Image
img = Image.open("icon.png")
img.save("icon.ico", format="ICO", sizes=[(256,256),(128,128),(64,64),(48,48),(32,32),(16,16)])
```

Depois compile:
```bash
pyinstaller --onefile --icon=icon.ico --name="Mac Chip" mac-chip.py
```

O executável será gerado em `dist/Mac Chip.exe` com o ícone da Mac Chip.

## Como funciona

1. Detecta todas as portas seriais do computador
2. Envia comandos AT para identificar modems GSM
3. Coleta IMEI, operadora, sinal, número e ICCID
4. Envia os dados para o servidor via API REST
5. Repete a cada 30 segundos
