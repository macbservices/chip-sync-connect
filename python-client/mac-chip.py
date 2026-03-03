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
import threading
from datetime import datetime, timezone, timedelta

# ============================================================
# CONFIGURAÇÃO
# ============================================================
API_URL = "https://eusbnxszzdtwgiblibhz.supabase.co/functions/v1/gsm-gateway"
SMS_URL = "https://eusbnxszzdtwgiblibhz.supabase.co/functions/v1/gsm-gateway/sms"
PENDING_URL = "https://eusbnxszzdtwgiblibhz.supabase.co/functions/v1/gsm-gateway/pending"
CONFIG_FILE = "config.json"
INTERVALO_SYNC = 30  # Full sync every 30s
INTERVALO_PENDING = 2  # Check for pending SMS every 2s
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1c2JueHN6emR0d2dpYmxpYmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzI4NTEsImV4cCI6MjA4NjkwODg1MX0.PTQQOeQEk3xVjF5Ry4BvltGRoJTMtPNxUODe5tTFw8g"
BAUDRATE = 115200
TIMEOUT_SERIAL = 3
# ============================================================

# Lock para acesso serial - impede que sync e pending leiam o mesmo modem ao mesmo tempo
serial_lock = threading.Lock()


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


def enviar_at(porta_serial, comando, espera=1, espera_final=0.5):
    """Envia um comando AT e retorna a resposta completa."""
    try:
        porta_serial.reset_input_buffer()
        porta_serial.write((comando + "\r\n").encode())
        time.sleep(espera)

        partes = []
        ultima_leitura = time.time()

        while True:
            waiting = porta_serial.in_waiting
            if waiting > 0:
                chunk = porta_serial.read(waiting).decode(errors="ignore")
                partes.append(chunk)
                ultima_leitura = time.time()
            elif time.time() - ultima_leitura >= espera_final:
                break

            time.sleep(0.05)

        return "".join(partes).strip()
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


def parse_sms_timestamp(modem_ts):
    """Converte timestamp do modem (ex: 26/03/03,14:22:11-12) para ISO UTC."""
    if not modem_ts or not isinstance(modem_ts, str):
        return None
    try:
        raw = modem_ts.strip()
        match = re.match(r"^(\d{2}/\d{2}/\d{2},\d{2}:\d{2}:\d{2})([+-])(\d{2})$", raw)
        if not match:
            dt = datetime.strptime(re.split(r"[+-]", raw)[0], "%y/%m/%d,%H:%M:%S")
            return dt.replace(tzinfo=timezone.utc).isoformat()

        base, sign, qh = match.groups()
        dt_local = datetime.strptime(base, "%y/%m/%d,%H:%M:%S")
        offset_minutes = int(qh) * 15
        if sign == "-":
            offset_minutes = -offset_minutes

        tz = timezone(timedelta(minutes=offset_minutes))
        dt_with_tz = dt_local.replace(tzinfo=tz)
        return dt_with_tz.astimezone(timezone.utc).isoformat()
    except Exception:
        return None


def descobrir_portas_gsm():
    return [p.device for p in serial.tools.list_ports.comports()]


def ler_sms(porta_serial, phone_number):
    """Lê mensagens SMS do modem via AT+CMGL."""
    mensagens = []
    try:
        enviar_at(porta_serial, "AT+CMGF=1", 0.5)
        enviar_at(porta_serial, 'AT+CPMS="SM","SM","SM"', 0.5)

        resp = enviar_at(porta_serial, 'AT+CMGL="ALL"', 3)

        if not resp or "+CMGL:" not in resp:
            return mensagens

        linhas = [l.strip() for l in resp.split("\n") if l.strip()]
        i = 0

        while i < len(linhas):
            linha = linhas[i]
            if not linha.startswith("+CMGL:"):
                i += 1
                continue

            idx_match = re.match(r"\+CMGL:\s*(\d+)", linha)
            if not idx_match:
                i += 1
                continue

            index = idx_match.group(1)
            quoted = re.findall(r'"([^"]*)"', linha)
            status = quoted[0] if len(quoted) >= 1 else ""
            sender = quoted[1] if len(quoted) >= 2 else ""
            timestamp = quoted[-1] if len(quoted) >= 3 else ""

            corpo_linhas = []
            j = i + 1
            while j < len(linhas):
                prox = linhas[j]
                if prox.startswith("+CMGL:") or prox == "OK":
                    break
                corpo_linhas.append(prox)
                j += 1

            msg_body = "\n".join(corpo_linhas).strip()

            status_upper = status.upper()
            is_incoming = ("REC" in status_upper) or (status == "")

            if is_incoming:
                parsed_received_at = parse_sms_timestamp(timestamp)
                mensagens.append({
                    "index": index,
                    "phone_number": phone_number,
                    "direction": "incoming",
                    "sender": sender or None,
                    "message": msg_body,
                    "received_at": parsed_received_at,
                })
                print(f"  📩 SMS de {sender or 'desconhecido'}: {msg_body[:50]}...")

            i = max(j, i + 1)

        # Delete read messages
        for msg in mensagens:
            enviar_at(porta_serial, f"AT+CMGD={msg['index']}", 0.5)

        for msg in mensagens:
            del msg["index"]

    except Exception as e:
        print(f"  [ERRO] Lendo SMS: {e}")

    return mensagens


def ler_sms_de_porta(porta_nome, phone_number):
    """Abre a porta serial, lê SMS e fecha. Thread-safe via serial_lock."""
    with serial_lock:
        portas_atuais = set(descobrir_portas_gsm())
        if porta_nome not in portas_atuais:
            return []

        ser = None
        try:
            ser = serial.Serial(porta_nome, BAUDRATE, timeout=TIMEOUT_SERIAL)
            time.sleep(0.5)
            resp = enviar_at(ser, "AT", 0.5)
            if "OK" not in resp:
                return []
            sms = ler_sms(ser, phone_number)
            ser.close()
            return sms
        except Exception as e:
            print(f"  [ERRO] Leitura SMS rápida {porta_nome}: {e}")
            return []
        finally:
            try:
                if ser and ser.is_open:
                    ser.close()
            except Exception:
                pass


def coletar_dados_modem(porta_nome):
    """Coleta dados completos do modem (usado no sync completo)."""
    print(f"\n📡 Lendo modem em {porta_nome}...")

    portas_atuais = set(descobrir_portas_gsm())
    if porta_nome not in portas_atuais:
        print(f"  [AVISO] Porta {porta_nome} não está mais disponível")
        return None, []

    ser = None
    try:
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

        phone = numero
        if not phone and iccid:
            phone = iccid[:11]

        # Read SMS during full sync too
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


def consultar_pending(api_key):
    """Consulta o servidor por chips com pedidos ativos aguardando SMS."""
    try:
        resp = requests.get(
            PENDING_URL,
            headers={
                "x-api-key": api_key,
                "apikey": SUPABASE_ANON_KEY,
            },
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            return data.get("pending", [])
        return []
    except Exception:
        return []


def normalizar_telefone(phone):
    """Remove tudo que não é dígito para comparação."""
    return re.sub(r"\D", "", phone or "")


def thread_pending_sms(api_key):
    """Thread dedicada: consulta pedidos pendentes a cada 2s e lê SMS sob demanda."""
    print("🔔 Thread de SMS sob demanda iniciada")
    while True:
        try:
            pending = consultar_pending(api_key)
            if pending:
                print(f"\n⚡ {len(pending)} chip(s) com pedido ativo aguardando SMS!")
                for item in pending:
                    port_name = item.get("port_name")
                    phone = item.get("phone_number")
                    if not port_name or not phone:
                        continue

                    print(f"  🔍 Lendo SMS do chip {phone} na porta {port_name}...")
                    sms = ler_sms_de_porta(port_name, phone)
                    if sms:
                        enviar_sms(api_key, sms)
                    else:
                        print(f"  📭 Nenhum SMS novo no chip {phone}")

            time.sleep(INTERVALO_PENDING)

        except Exception as e:
            print(f"  [ERRO] Thread pending: {e}")
            time.sleep(INTERVALO_PENDING)


def main():
    print("=" * 50)
    print("   Mac Chip - Cliente Local v3.0")
    print("=" * 50)

    api_key = obter_api_key()

    print(f"\n🌐 Servidor: {API_URL}")
    print(f"⏱️  Sync completo: {INTERVALO_SYNC}s | SMS sob demanda: {INTERVALO_PENDING}s")
    print("\nPressione Ctrl+C para encerrar.\n")

    # Inicia thread de SMS sob demanda
    t = threading.Thread(target=thread_pending_sms, args=(api_key,), daemon=True)
    t.start()

    # Loop principal: sync completo (modems + chips)
    while True:
        try:
            portas = descobrir_portas_gsm()
            if not portas:
                print("\n⚠️  Nenhuma porta serial encontrada.")
            else:
                print(f"\n📋 {len(portas)} porta(s): {', '.join(portas)}")
                modems = []
                with serial_lock:
                    for p in portas:
                        result = coletar_dados_modem(p)
                        modem_data, sms_mensagens = result

                        if modem_data:
                            modems.append(modem_data)

                        if sms_mensagens:
                            enviar_sms(api_key, sms_mensagens)

                if modems:
                    sincronizar(api_key, modems)

                if not modems:
                    print("⚠️  Nenhum modem GSM respondeu")

            print(f"💤 Próximo sync completo em {INTERVALO_SYNC}s...")
            time.sleep(INTERVALO_SYNC)

        except KeyboardInterrupt:
            print("\n\n👋 Encerrando...")
            break


if __name__ == "__main__":
    main()
