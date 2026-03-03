"""
Mac Chip - Cliente Local
Lê dados dos modems GSM e SMS via porta serial e envia para o dashboard web.
Compile com: pyinstaller --onefile --icon=icon.ico --name="Mac Chip" mac-chip.py
"""

import serial
import serial.tools.list_ports
import requests
import time
import json
import re
import sys
import os

# ============================================================
# CONFIGURAÇÃO
# ============================================================
API_URL = "https://eusbnxszzdtwgiblibhz.supabase.co/functions/v1/gsm-gateway"
SMS_URL = "https://eusbnxszzdtwgiblibhz.supabase.co/functions/v1/gsm-gateway/sms"
CONFIG_FILE = "config.json"
INTERVALO_SYNC = 30
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1c2JueHN6emR0d2dpYmxpYmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzI4NTEsImV4cCI6MjA4NjkwODg1MX0.PTQQOeQEk3xVjF5Ry4BvltGRoJTMtPNxUODe5tTFw8g"
BAUDRATE = 115200
TIMEOUT_SERIAL = 3
# ============================================================


def carregar_config():
    """Carrega configuração do arquivo local."""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def salvar_config(config):
    """Salva configuração no arquivo local."""
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


def obter_api_key():
    """Obtém a API key da config ou pede ao usuário."""
    config = carregar_config()

    if config.get("api_key"):
        print(f"🔑 API Key carregada: {config['api_key'][:8]}...")
        resp = input("   Usar esta chave? (S/n): ").strip().lower()
        if resp not in ("n", "nao", "não", "no"):
            return config["api_key"]

    print("\n" + "=" * 50)
    print("  CONFIGURAÇÃO INICIAL")
    print("=" * 50)
    print("\n1. Acesse o dashboard web e faça login")
    print("2. Crie uma Localização (ou use uma existente)")
    print("3. Copie a API Key gerada\n")

    api_key = input("Cole sua API Key aqui: ").strip()

    if not api_key:
        print("❌ API Key não pode ser vazia!")
        input("Pressione Enter para sair...")
        sys.exit(1)

    # Testar a API key
    print("\n🔄 Verificando API Key...")
    try:
        resp = requests.post(
            API_URL,
            json={"modems": []},
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "apikey": SUPABASE_ANON_KEY,
            },
            timeout=10,
        )
        if resp.status_code == 200:
            print("✅ API Key válida!")
            config["api_key"] = api_key
            salvar_config(config)
            return api_key
        else:
            print(f"❌ API Key inválida (erro {resp.status_code})")
            input("Pressione Enter para sair...")
            sys.exit(1)
    except requests.exceptions.ConnectionError:
        print("⚠️  Sem internet. Salvando chave mesmo assim...")
        config["api_key"] = api_key
        salvar_config(config)
        return api_key


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
    match = re.search(r"\d{15}", resposta)
    return match.group(0) if match else None


def extrair_operadora(resposta):
    match = re.search(r'"(.+?)"', resposta)
    return match.group(1) if match else None


def extrair_sinal(resposta):
    match = re.search(r"\+CSQ:\s*(\d+)", resposta)
    if match:
        csq = int(match.group(1))
        return None if csq == 99 else csq
    return None


def extrair_numero(resposta):
    match = re.search(r'"(\+?\d+)"', resposta)
    return match.group(1) if match else None


def extrair_iccid(resposta):
    match = re.search(r"\d{19,20}", resposta)
    return match.group(0) if match else None


def descobrir_portas_gsm():
    return [p.device for p in serial.tools.list_ports.comports()]


def ler_sms(porta_serial, phone_number):
    """Lê todas as mensagens SMS não lidas do modem via AT+CMGL."""
    mensagens = []
    try:
        # Set text mode
        enviar_at(porta_serial, "AT+CMGF=1", 0.5)
        # Read all messages (ALL to catch everything, then we filter)
        resp = enviar_at(porta_serial, 'AT+CMGL="ALL"', 2)

        if not resp or "+CMGL:" not in resp:
            return mensagens

        # Parse SMS entries
        linhas = resp.split("\n")
        i = 0
        while i < len(linhas):
            linha = linhas[i].strip()
            if linha.startswith("+CMGL:"):
                # Format: +CMGL: <index>,<stat>,<oa/da>,[<alpha>],[<scts>]
                match = re.match(
                    r'\+CMGL:\s*(\d+),"([^"]*?)","([^"]*?)",[^,]*,"([^"]*?)"',
                    linha,
                )
                if match:
                    index = match.group(1)
                    status = match.group(2)
                    sender = match.group(3)
                    timestamp = match.group(4)

                    # Next line(s) = message body
                    msg_body = ""
                    if i + 1 < len(linhas):
                        msg_body = linhas[i + 1].strip()
                        # Skip if it's another +CMGL or OK
                        if msg_body.startswith("+CMGL:") or msg_body == "OK":
                            msg_body = ""
                        else:
                            i += 1

                    mensagens.append({
                        "index": index,
                        "phone_number": phone_number,
                        "direction": "incoming",
                        "sender": sender,
                        "message": msg_body,
                        "received_at": None,  # Will use server time
                    })
                    print(f"  📩 SMS de {sender}: {msg_body[:50]}...")
            i += 1

        # Delete read messages to avoid re-sending
        for msg in mensagens:
            enviar_at(porta_serial, f"AT+CMGD={msg['index']}", 0.5)

        # Remove index key before sending
        for msg in mensagens:
            del msg["index"]

    except Exception as e:
        print(f"  [ERRO] Lendo SMS: {e}")

    return mensagens


def coletar_dados_modem(porta_nome):
    print(f"\n📡 Lendo modem em {porta_nome}...")

    # Evita tentar abrir porta que sumiu entre a varredura e a leitura
    portas_atuais = set(descobrir_portas_gsm())
    if porta_nome not in portas_atuais:
        print(f"  [AVISO] Porta {porta_nome} não está mais disponível")
        return None, []

    ser = None
    try:
        # Uma tentativa de reabertura para casos de reconexão rápida USB
        for tentativa in range(2):
            try:
                ser = serial.Serial(porta_nome, BAUDRATE, timeout=TIMEOUT_SERIAL)
                break
            except serial.SerialException as e:
                erro = str(e).lower()
                porta_indisponivel = (
                    "could not open port" in erro
                    or "filenotfounderror" in erro
                    or "acesso negado" in erro
                    or "permissionerror" in erro
                )

                if porta_indisponivel and tentativa == 0:
                    time.sleep(0.5)
                    continue

                if porta_indisponivel:
                    print(f"  [AVISO] Porta {porta_nome} indisponível/ocupada")
                    return None, []

                print(f"  [ERRO] {porta_nome}: {e}")
                return None, []

        if not ser:
            print(f"  [AVISO] Porta {porta_nome} indisponível")
            return None, []

        time.sleep(1)

        resp = enviar_at(ser, "AT")
        if "OK" not in resp:
            print(f"  [AVISO] Porta {porta_nome} não respondeu ao AT")
            ser.close()
            return None, []

        imei = extrair_imei(enviar_at(ser, "AT+GSN"))
        operadora = extrair_operadora(enviar_at(ser, "AT+COPS?"))
        sinal = extrair_sinal(enviar_at(ser, "AT+CSQ"))
        numero = extrair_numero(enviar_at(ser, "AT+CNUM"))
        iccid = extrair_iccid(enviar_at(ser, "AT+CCID"))
        if not iccid:
            iccid = extrair_iccid(enviar_at(ser, "AT+ICCID"))

        # Determine phone number for SMS reading
        phone = numero
        if not phone and iccid:
            phone = iccid[:11]

        # Read SMS messages
        sms_mensagens = []
        if phone:
            sms_mensagens = ler_sms(ser, phone)

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
            modem_data["chips"].append({
                "phone_number": numero, "iccid": iccid,
                "operator": operadora, "status": "active",
            })
        elif iccid:
            modem_data["chips"].append({
                "phone_number": iccid[:11], "iccid": iccid,
                "operator": operadora, "status": "active",
            })

        print(f"  IMEI: {imei} | Op: {operadora} | Sinal: {sinal} | Nº: {numero} | SMS: {len(sms_mensagens)}")
        return modem_data, sms_mensagens

    except serial.SerialException as e:
        print(f"  [AVISO] {porta_nome}: indisponível/ocupada ({e})")
        return None, []
    except Exception as e:
        print(f"  [ERRO] {porta_nome}: {e}")
        return None, []
    finally:
        try:
            if ser and ser.is_open:
                ser.close()
        except Exception:
            pass


def sincronizar(api_key, modems_data):
    try:
        print(f"\n🔄 Enviando dados de {len(modems_data)} modem(s)...")
        resp = requests.post(
            API_URL,
            json={"modems": modems_data},
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "apikey": SUPABASE_ANON_KEY,
            },
            timeout=15,
        )
        if resp.status_code == 200:
            print("✅ Sincronizado com sucesso!")
        else:
            print(f"❌ Erro {resp.status_code}: {resp.text}")
    except requests.exceptions.ConnectionError:
        print("❌ Sem conexão com a internet")
    except Exception as e:
        print(f"❌ Erro: {e}")


def enviar_sms(api_key, mensagens):
    """Envia SMS coletados para o servidor."""
    if not mensagens:
        return
    try:
        print(f"📨 Enviando {len(mensagens)} SMS para o servidor...")
        resp = requests.post(
            SMS_URL,
            json={"messages": mensagens},
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "apikey": SUPABASE_ANON_KEY,
            },
            timeout=15,
        )
        if resp.status_code == 200:
            result = resp.json()
            print(f"✅ {result.get('inserted', 0)} SMS registrados!")
        else:
            print(f"❌ Erro SMS {resp.status_code}: {resp.text}")
    except requests.exceptions.ConnectionError:
        print("❌ Sem conexão com a internet")
    except Exception as e:
        print(f"❌ Erro SMS: {e}")


def main():
    print("=" * 50)
    print("   Mac Chip - Cliente Local v2.0")
    print("=" * 50)

    api_key = obter_api_key()

    print(f"\n🌐 Servidor: {API_URL}")
    print(f"⏱️  Intervalo: {INTERVALO_SYNC}s")
    print("\nPressione Ctrl+C para encerrar.\n")

    while True:
        try:
            portas = descobrir_portas_gsm()
            if not portas:
                print("\n⚠️  Nenhuma porta serial encontrada.")
            else:
                print(f"\n📋 {len(portas)} porta(s): {', '.join(portas)}")
                modems = []
                all_sms = []
                for p in portas:
                    result = coletar_dados_modem(p)
                    if result[0]:
                        modems.append(result[0])
                        all_sms.extend(result[1])

                if modems:
                    sincronizar(api_key, modems)

                if all_sms:
                    enviar_sms(api_key, all_sms)

                if not modems:
                    print("⚠️  Nenhum modem GSM respondeu")

            print(f"💤 Próximo sync em {INTERVALO_SYNC}s...")
            time.sleep(INTERVALO_SYNC)

        except KeyboardInterrupt:
            print("\n\n👋 Encerrando...")
            break


if __name__ == "__main__":
    main()
