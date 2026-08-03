import zlib, struct, sys

def decode_png(path):
    data = open(path, 'rb').read()
    pos = 8
    idat = b''
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos+4])[0]
        typ = data[pos+4:pos+8]
        chunk = data[pos+8:pos+8+ln]
        if typ == b'IHDR': w,h,bd,ct = struct.unpack('>IIBB', chunk[:10])
        elif typ == b'IDAT': idat += chunk
        elif typ == b'IEND': break
        pos += 12 + ln
    raw = zlib.decompress(idat)
    ch = {0:1,2:3,3:1,4:2,6:4}[ct]
    stride = w*ch
    out = bytearray(w*h*ch); prev = bytearray(stride); i = 0
    for y in range(h):
        f = raw[i]; i += 1
        line = bytearray(raw[i:i+stride]); i += stride
        if f==1:
            for x in range(ch, stride): line[x]=(line[x]+line[x-ch])&255
        elif f==2:
            for x in range(stride): line[x]=(line[x]+prev[x])&255
        elif f==3:
            for x in range(stride):
                a=line[x-ch] if x>=ch else 0
                line[x]=(line[x]+((a+prev[x])>>1))&255
        elif f==4:
            for x in range(stride):
                a=line[x-ch] if x>=ch else 0; b=prev[x]; c=prev[x-ch] if x>=ch else 0
                p=a+b-c; pa,pb,pc=abs(p-a),abs(p-b),abs(p-c)
                pr=a if (pa<=pb and pa<=pc) else (b if pb<=pc else c)
                line[x]=(line[x]+pr)&255
        out[y*stride:(y+1)*stride]=line; prev=line
    return w,h,ch,out

w,h,bpp,px = decode_png(sys.argv[1])
def lum(x,y):
    o=(y*w+x)*bpp
    return 0.299*px[o]+0.587*px[o+1]+0.114*px[o+2]

# Feed composer textarea was at l=420 t=366 w=478 h=68
print("=== Feed composer region (l=420 t=366 w=478 h=68) ===")
for y in range(368, 432, 8):
    row = ''.join('#' if lum(x,y) > 90 else ' ' for x in range(418, 900))
    print(f"y={y}: |{row}| ")
# first glyph position
for y in range(368, 432):
    for x in range(418, 900):
        if lum(x,y) > 90:
            print("FIRST GLYPH at x=", x, "y=", y); raise SystemExit
