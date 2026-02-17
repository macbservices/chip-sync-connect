"""
GSM Gateway Client - Envia dados dos modems para o dashboard web.
Compile com: pyinstaller --onefile app_gsm.py
"""

import serial
import serial.tools.list_ports
import requests
import time
import json
import re
import sys

# ============================================================
# CONFIGURAÇÃO - Altere estes valores antes de compilar
# ============================================================
API_URL = "https://eusbnxszzdtwgiblibhz.supabase.co/functions/v1/gsm-gateway"
API_KEY = "SUA_API_KEY_AQUI"  # Copie do dashboard web
INTERVALO_SYNC = 30  # segundos entre cada sincronização
BAUDRATE = 115200
TIMEOUT_SERIAL = 3
# ============================================================


def enviar_at(porta_serial, comando, espera=1):
    """Envia um comando AT e retorna a resposta."""
    try:
        porta_serial.write((comando + "\r\n").encode())
        time.sleep(espera)
        resposta = porta_serial.read(porta_serial.in_waiting).decode(errors="ignore")
        return resposta.strip()
    except Exception as e:
        print(f"  [ERRO] Comando {comando}: {e}")
        return ""


def extrair_imei(resposta):
    """Extrai IMEI da resposta do AT+GSN."""
    match = re.search(r"\d{15}", resposta)
    return match.group(0) if match else None


def extrair_operadora(resposta):
    """Extrai nome da operadora da resposta do AT+COPS?."""
    match = re.search(r'"(.+?)"', resposta)
    return match.group(1) if match else None


def extrair_sinal(resposta):
    """Extrai nível de sinal da resposta do AT+CSQ."""
    match = re.search(r"\+CSQ:\s*(\d+)", resposta)
    if match:
        csq = int(match.group(1))
        if csq == 99:
            return None
        return csq
    return None


def extrair_numero(resposta):
    """Extrai número de telefone da resposta do AT+CNUM."""
    match = re.search(r'"(\+?\d+)"', resposta)
    return match.group(1) if match else None


def extrair_iccid(resposta):
    """Extrai ICCID da resposta do AT+CCID ou AT+ICCID."""
    match = re.search(r"\d{19,20}", resposta)
    return match.group(0) if match else None


def descobrir_portas_gsm():
    """Lista todas as portas seriais disponíveis."""
    portas = serial.tools.list_ports.comports()
    return [p.device for p in portas]


def coletar_dados_modem(porta_nome):
    """Coleta dados de um modem via comandos AT."""
    print(f"\n📡 Lendo modem em {porta_nome}...")
    try:
        ser = serial.Serial(porta_nome, BAUDRATE, timeout=TIMEOUT_SERIAL)
        time.sleep(1)

        # Testar comunicação
        resp = enviar_at(ser, "AT")
        if "OK" not in resp:
            print(f"  [AVISO] Porta {porta_nome} não respondeu ao AT")
            ser.close()
            return None

        # Coletar dados do modem
        imei = extrair_imei(enviar_at(ser, "AT+GSN"))
        operadora = extrair_operadora(enviar_at(ser, "AT+COPS?"))
        sinal = extrair_sinal(enviar_at(ser, "AT+CSQ"))
        numero = extrair_numero(enviar_at(ser, "AT+CNUM"))
        iccid = extrair_iccid(enviar_at(ser, "AT+CCID"))

        # Se AT+CCID falhar, tentar AT+ICCID
        if not iccid:
            iccid = extrair_iccid(enviar_at(ser, "AT+ICCID"))

        ser.close()

        modem_data = {
            "port_name": porta_nome,
            "imei": imei,
            "operator": operadora,
            "signal_strength": sinal,
            "status": "online",
            "chips": [],
        }

        if numero:
            modem_data["chips"].append(
                {
                    "phone_number": numero,
                    "iccid": iccid,
                    "operator": operadora,
                    "status": "active",
                }
            )
        elif iccid:
            modem_data["chips"].append(
                {
                    "phone_number": iccid[:11],  # fallback
                    "iccid": iccid,
                    "operator": operadora,
                    "status": "active",
                }
            )

        print(f"  IMEI: {imei}")
        print(f"  Operadora: {operadora}")
        print(f"  Sinal: {sinal}")
        print(f"  Número: {numero}")
        print(f"  ICCID: {iccid}")

        return modem_data

    except serial.SerialException as e:
        print(f"  [ERRO] Não foi possível abrir {porta_nome}: {e}")
        return None
    except Exception as e:
        print(f"  [ERRO] Erro inesperado em {porta_nome}: {e}")
        return None


def sincronizar(modems_data):
    """Envia dados dos modems para o servidor."""
    payload = {"modems": modems_data}

    try:
        print(f"\n🔄 Enviando dados de {len(modems_data)} modem(s)...")
        resp = requests.post(
            API_URL,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "x-api-key": API_KEY,
            },
            timeout=15,
        )

        if resp.status_code == 200:
            print("✅ Sincronizado com sucesso!")
            return True
        else:
            print(f"❌ Erro {resp.status_code}: {resp.text}")
            return False

    except requests.exceptions.ConnectionError:
        print("❌ Sem conexão com a internet")
        return False
    except Exception as e:
        print(f"❌ Erro ao sincronizar: {e}")
        return False


def main():
    print("=" * 50)
    print("   GSM Gateway Client v1.0")
    print("=" * 50)

    if API_KEY == "SUA_API_KEY_AQUI":
        print("\n⚠️  ATENÇÃO: Configure sua API_KEY antes de usar!")
        print("   Acesse o dashboard web, crie uma localização,")
        print("   e copie a API Key gerada para este arquivo.")
        print("\n   Edite a variável API_KEY no início do arquivo.")
        input("\nPressione Enter para sair...")
        sys.exit(1)

    print(f"\n🔑 API Key: {API_KEY[:8]}...")
    print(f"🌐 Servidor: {API_URL}")
    print(f"⏱️  Intervalo: {INTERVALO_SYNC}s")

    while True:
        try:
            portas = descobrir_portas_gsm()

            if not portas:
                print("\n⚠️  Nenhuma porta serial encontrada. Aguardando...")
            else:
                print(f"\n📋 {len(portas)} porta(s) encontrada(s): {', '.join(portas)}")

                modems = []
                for porta in portas:
                    dados = coletar_dados_modem(porta)
                    if dados:
                        modems.append(dados)

                if modems:
                    sincronizar(modems)
                else:
                    print("⚠️  Nenhum modem GSM respondeu")

            print(f"\n💤 Aguardando {INTERVALO_SYNC} segundos...")
            time.sleep(INTERVALO_SYNC)

        except KeyboardInterrupt:
            print("\n\n👋 Encerrando...")
            break


if __name__ == "__main__":
    main()
