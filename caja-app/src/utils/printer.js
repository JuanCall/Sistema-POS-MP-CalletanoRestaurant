import { formatMesaName } from './helpers';
import { agruparParaTickets } from './math';

export const generarTicketHTML = (mesa, pedido, total, pagos, recibido, vuelto, usuarioActivo, modoDomingo, esPrecuenta = false, esBoleta = false, cliente = null, numBoleta = null) => {
    const fechaActual = new Date().toLocaleString('es-PE'); 
    // 🟢 Filtrar bebidas de costo 0 incluidas en el menú (isMenuDrink)
    const pedidoLimpio = agruparParaTickets(pedido).filter(item => 
        !(item.precio === 0 && item.isMenuDrink)
    );
    
    // 🟢 REGLA: Agrupar por fecha si es Pre-Cuenta de una CTA abierta
    let itemsPorFecha = {};
    if (esPrecuenta && String(mesa).startsWith('CTA-')) {
        pedidoLimpio.forEach(item => {
            const fechaItem = item.fecha_agregado || new Date().toISOString().split('T')[0];
            if(!itemsPorFecha[fechaItem]) itemsPorFecha[fechaItem] = [];
            itemsPorFecha[fechaItem].push(item);
        });
    } else {
        itemsPorFecha['TODOS'] = pedidoLimpio;
    }

    let itemsHTML = '';
    for (const [fecha, items] of Object.entries(itemsPorFecha)) {
        if (fecha !== 'TODOS') {
            itemsHTML += `<tr><td colspan="4" style="text-align: center; border-bottom: 1px dashed #000; padding: 6px 0; font-weight: bold;">- Consumos del ${fecha} -</td></tr>`;
        }
        items.forEach(item => { 
            const isMenu = ['entradas', 'segundos'].includes(item.categoria?.toLowerCase());
            const nombreM = `${item.nombre}${isMenu ? ' ' + (modoDomingo ? '(ALM)' : '(MENÚ)') : ''}`;
            let extraStr = item.modalidad !== 'local' ? `<br><small style="font-size:10px">*[${item.modalidad.toUpperCase()}]</small>` : '';
            
            itemsHTML += `
                <tr>
                  <td style="padding:4px 0;border-bottom:1px dashed #ccc;text-align:left;">${item.cantidad}</td>
                  <td style="padding:4px 0;border-bottom:1px dashed #ccc;">${nombreM}${extraStr}</td>
                  <td style="padding:4px 0;border-bottom:1px dashed #ccc;text-align:right;">S/ ${(item.subtotal/item.cantidad).toFixed(2)}</td>
                  <td style="padding:4px 0;border-bottom:1px dashed #ccc;text-align:right;font-weight:bold;">S/ ${item.subtotal.toFixed(2)}</td>
                </tr>`; 
        });
    }

    // 🟢 CABECERA SUNAT
    let cabeceraHTML = '';
    if (esBoleta) {
        cabeceraHTML = `
            <div style="text-align: center; margin-bottom: 10px;">
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAkAAAAFLAQAAAAAWzg7FAAAulklEQVR4nK28fZwdVZXv/d1V1X1OkianSHJJA7FPJUSCjg6N6KWRmFOJGUGdIZkHX3AG5SA4oKPS+DI0GHJ2J7mm7wxKO/ooc0W64ToPjHdUXvQCinSFtBIVTOfiKGigq5NAAoZ09QvpOt11aj1/VJ23TpgZP8+z/jmnXvZvr7X22nuvtfbehewU8TIS5yXK+TnZLVKWRgpNeW3yc7W/Bj0EnIxCIKI7EwEQeHBsJgoBL4IoTN+oUwoY50X2zq9w4N9hZj4ZI4M1TNtPfvVJOZxHfiqIljjhTL4hoylHoyKyO2XwISl9f1TPiZTlDyJSeGWqUhKZu0VKMyKVGRmdzxFSaRJtt6Q3ZOZG0X+MaAlbjUzHyU9r8T8jYY2MaJYQhfKpuMDaMbURIGTqt2ADHAWIJdYCvEYTg2FlCRoY2g+gIUtlfcrfMkAbGFo16Xo+JRJGSvaGhVERCfMicyKyX8bDkpdvVMO4iEyJhOaJdjF3h1FnN+M5AAIW4EQAB6rVVRubxD7nm4gVILrQCF1Jm3CnNzceljxk5j/XaAlHEMaDidTGfNGzzZe+dqNITtDQLIjuLKV6KlRkKCqISFAK8t5F40DGPDz3n2GoMNrAgekZuPNqamf26RPa5yTkNYgSvcY76jXuz6MUqJI0VUJHAApeRUR8/E55rSpOBgTwqK799XXoe0l5F2XBySywkVx4VnfmAzUU5sfrqnNLIiJ/EIklwpil4ZGMz8W3+NfPV3Z5v+EkiH7SrxLShFSwYvB1ylCNbEtta3w3oVaM6zIewNn1hyOeSxaTOQPlaOLZeeXmbvkIaac8uY4aBRbtJn9CBLyGh0Gq+tXzS5V3PpkP1NAxJLXLuTk/9+LhaFTG41G569cYvjlXOsECK/PGyP1VjmzQwwBYVsZbcrsCJMubQYGlT+DawIHGETEBMnSQXKYl5rzYJqKNfbfDa9tqo7UalF2AU6UGdJODVYyj583YYnAzgNV3MpCReSwC0J1WGkCkoceN2lAcE/dEoarkdzZfP6I782YmEpFRmZkSEQnJHX6lPFM5dvgPUfwBoDppj5dKsYjMicQyJNXGSSkBopBezolIyClPz8STzx2b+WU5+noD0L9LBngQuh5UAMsHMM6O6KMSLjMqH9ewoqqPGPbDbE0LJ+ooowsRZtLtAaZa1wsWDz86OzLv5dXQl0xTdsMDDTwicd6U6AKRgbj0vIiIRy6OKu947qW93x9/YdwnI7kq/zmRsvSmc/EpoyIiUaK+dKat6CwcVqxMKphW27aVPGX3B0f65zdWjWuS/m4CYKeimRpQolNDtVgfrnLFW+vt0fNwXtM2DWCsDSCaVShwWZfZo51LglVn54uD3wG6UgidMrC1BqpBV2syuphMe8xWCBIvrFMH/hle8PzBQmcMM7pheOxtYMLSjRPlrlSPM+Mi4yURuV5E5PDeKRnf9Wg0KiIyk5OqOzezW0QkzojEmCIyI7cdK4mIRDWgZpoaF5G5SrnWWCKJKe+uvhFjNtp2xK4BkVgkTq4H0rrLMzMiv71oqpQCjR5PnutT60DI1FAdqDoelcEHl9RinwbJnulNX4C3lRCcBclrXXajM9vGqzy8l6TQroFAVT2FciS/nxMRmdi6SUQuKj/5D6NpjYcTng/+qCqOh5mZiksiMjpViiRKgObTahmohJm9lW99q3pnTCQqiByOSyJROQUK0ocVEbFg+ETreqPWkuXbix5p+ShQMWsPTrVvANME1p5okAvFbrgRYIf+V9yR2ZLc8fH7H0+NkNSm5XdVHRkNyhIt1REysbjZCpFNcG+E0/kHza9H7uK6mjFaALf9ZZPHJACDgIKyPJH6aTMiMi4lOVgqXX+4NCASTR2MRK6Pr68aTFAOT7k+7fBxMReaMiUiEohIRD0Weig1kILI+TNxSSR+8z1lmRmvt0FQnnpxtAlITgYkcUlEZHxQ5JHJLSIi3xw/uDfONALdM3VldQgakyagxilbaY6MYG+yeeXzJYC37nm5eODoycICALzG0Yl6fUNDEksl3ro3KMniG0VEXrzszOszc3W/NpLr950qIoeFUsyQX8qIDIhMiUjUAJTK1zEqGRkdFxGZuv3qsFTOvwZQzt+SiD0lIlGz80PSki89NeXYQOuP/3VYx17DQ1902u4CmA2CNuqoajHkNrgegPnXo1cw7TSFnFMAEyQG9CMAKmW7GchJlLkaDupBAMNZ4vN1r2qBoYJs2wkipHRhVQGVWiMXREolEZH4yoslOr0ylGqoILLpmZ2yM2pFRDSYFRmfkYGp8LPVwK9RSG/RMJVSoq4lPRz6heE2VtwUUhiQpZj8/Q00+PsPg8srrkq9kMfg3EebJZioziqgNDh4yXye8hEBhH4AzBiLNlbt7stMfGIz9bliv8MyarN/IoAL9Cc6CrsyUh3hk1544S2JWr4xZD5Rt7B3iFz/zFdEIjpEnnfI706CwScxZcqAppRCG8D4JVUW1EVd9WcbGoMXx6/dd2ui5cLGW3CoNjFv/5eTpBNMAFUtkzzPkkvaWyQnBRGRV0REJBVttDGAjEsi339mu8huOnJ+IaQ9F+ZzAxXJ6ZzMGdRdJg9gCTC545PJnWhsia52g1BtBTiNpAtEAArcRFYLkd1+YaYiUhiScRmSUkmicXkpYeKXT5RFRJ4aEtk7JCI3rRlRUy+aZYHCEaADkZKIX6oaZNZI6yFCY9ZHnXY0kJikwCU6m602vt2ko2ojDINXxMa1NE2xh0EgfifDdKLCUCDi9CjVQ2Y/yUindFOnFQ/iESB2q9XYgVxng07mi2y2U5cX0cpJSaoJrsLBl75bEZkZFfn+2HNpq/lvbxjzxgLu2dciA1IWCUXEb1uXDHoDUtVRWQPtly2chBkHTj3bSdvxjJ+nYoZhufTh5eLOSwPUtdkgWuWi5XaS1rpo2k+Lvxq5yb8joLbPKEemOpuAquUrBkyntX9jwf98Bxon0tbqfPp8wToqDAFOlgc/YuRDln8tmTncKpQ7OF2cPhLUOSoH674ZJL7l+mJ6+97MA5gkut997r68H87c8LaHUmmD5nSDVIJ8QUSk4hWeKGaSPuEnjqGcy39NOriMieTMKC+Ho9z/GBoV2Ski2hwblajgm+K3Xlfn6PmL9Xe62skCcm7ivErX1t+kT1dQ+fja3T6nnvXAxUl6qJF8bANx8agUnDM/4a+5yB8+InAgaEvYD9Sv3dSE4wve67mQ2XfBh/tTkTJeB4+bIx7ikqlz1LrT/cC9Gl6ldC7DRYC4QH446dOB8ddXaIDcN97dFHVX1W4ARzT8SH5iuS3/d/kdTtvgRwPGXYBKh8crN9oBsGT3AV8D8NEP7euDsgtd4PwKaJvTsxhJLDaNOsNg4c1ZoFCg4gYAs7+8hNyXtB1AcMFlfsLAKVd8qB+gnIhcSflKRTNho3LE7AeW+LzQ3Q4wzsfh1RUBYB+7IlWx+l9PH52v7BSo7KGhH894qOTBKPxp75MAL/OvDq3X2ED8w2K1yJKHTtFAX52bVreeNVKjb7gc1aHvh5HO8id3vATwF5V9h0F6g37G/+3LVaCW7z5Yd2m7q2CERTK5naNjcr2I3J+beWJqQLaPf/VYSSQ+/zOFnkI8JCK/j+rTkuzvzuXEh0y0DhnIxeR3S0MX8QFnWZY2t3LHoiNfGoTZtZ//3Y2JF7565vK6Os68d/okOsou96Dc6YsNZD78OeCFZ2THtuvgpdXZ7+l/2wrd+OViQ5nvVX4EULZ261qfr7kOaMBeCpz7p5f/atb4OJz92OB5xuL/BnDGd3UdqOVbDRc1dLId7Z7mMTzA+ql1Bg+8fG77y397a7b3bZ+xrC8vmHXp59VfNJRR73/X/67qmnJ8ACBn8C2XCSaSiWrh+EKfC37W6x/9qnlT70Nv/Ruz07UAjn+ysfa3ftM7CUcpxRuAaOZ6TYuHc+m2z5TiN2VeKXWOAJDb3Fho0cMnigYrOgAK0aUiMuusUBJGhef/bk2cCZ7b/6mO0cSTO56MT+Jhikj5S7nIAVCB3K40+d11j80NTtegxj9hk5ne+/KHlsirS//+Wxv+n6jH8ICva4Co7JYqNrR8qNr+jWnTdoCClO8fEqnkDypRIp/9x9K4yOiNP50oJJycLyIie7WIaBE5j1K8uBPUdi+zV0QiSlYVWN57EBj8VRaXyt8e7jKgsiVodVP1Asi/3OO6as7xuefYIyfTEmDKwBevF4mHnvkHURLvL5cPi4yWZ16RgblSSaK9IiLlXUEmDjO7RY4WCwlHO6teUqmqI1l+8wjQuezHGtTG2dlJmDAtOGId0shmgF9dat9kZC98s2bhSLKyMD9tnusrxUfjvIhsmr5aKBbknsMfmSs/9J7K2aLNMZG/KYmIrOiineyWjrzI7cWYTqCjMyM+oAYSjro9XlEeMGLsAeCcw8Ufn3bJW3ufTWpq1UDlfX0cwf7Dx+5F3jqYPAhqzNQM8u04gLbCV3IOjDy1rvDMyPpdRag48ApA5YMu7HrD6a+8EfU/0gkgpJ18BFSnVFSSey2qV97iAf4Zt4BzvJi8Hv8VwLH3g1UYeezOP9G8t+ajFtPsk1FVWnfKoUIz/Fseoc/Orrzv3gToBwAvvA+ukB+84Yd/O8iaW31OpJwZmvL9xPIqS3I5ff5EvH/2J9NTvzx8zAY1Fe8VEen0eF1GKl09Y0/I0Q3DQCeQF4kwZaCmIy/9Pc6EJhv7Ier46qMLfKBtJgDkfJeDEGW+/sE7WHhgyzxuakA+lLOAJid7Xq68arnYnKMcaKXVA+ZWgo+sLr7wgR/Scqxa8ZhSVqOyY9IAIKSsg43ltmMYc/tfbnGAaE4Ds1+DQXiFBe//O2383Xz9GMBkAEClxwBYNsOSPVPn/22IcdnpyguZWT0DMJUFzSSY73/boNoIhCN1HL/KkTHIzFXiQvYSIHhhwaNE5k/p1ZAu1R0fBGCZy9c/fZ+6edVr6ehh9p8lHlHfw2/RqvgLdR1G66DyOkFd+TuAf0u0Uunm9R+8nQ+/WCtcbAKSNp660IWXgd71+jstW+DVK5KXXv0BwP26WueCdd9hceg2pyUMSMa2Dvn1PR6cafvA6HnYGIvaK53FLJSuA+SjgAtHHMz/9QXWbPPmqxvIiRSeqezOi0iwS4vs/dnoY2dWXpWhoWMuFMIBEan0oX5OXqauF7njZ6Wj7vJOoCcB2KLqUXbHhnf7MLHU08Cf+D/fA+AaGlCDQNyHXAxUPHjPp7yFDnDCUldORP7A+SIyEisu3Ll37tw5qbwqQ1LZq3MyWRKR4w67NPnCxBqRufaBWYdO4KYUoYGjhf4dANtcAHNEHABXBT3EkQaOO5Q0SXSjvrdHBSdmVfKyW2ToWGFUREZQkJHKaFkq0yX5vfxGRI6KiDyjQdOem7tARK4+v3I7mLrGEfmUI82puzSQ1Qmnm4cBzRFUuS9+CuAR3ZAqftvfqOBUmLd2nZfdIjLKlSJyBAUU4kJFKtMiIjOVSuVpEZHUktvO/EsROfrJeBhMTQ+ggrqOjvDS+vcE82WOPMDAOATIhupIs9OGRb/ovXveywZAW/tI618+70BltYumv/qwEwDvPoDrSCLwykM3gPE+by3ZimZ3I1bqGXKuxLnIBXROJM7/cFpKcwMyJOObEntsay1CwVdRXuKfFu5nEZAR8fLURYsRh5CDwTC0hQDKyyaP9pDrB6I+embvBli+9BrUp4vnJNI3iuYCMIbN99TF6/9+JsuECysA9nn07PI8QNl8MrHj2fs/BR/rzOkmFU1YdU1dIS+Zr1qcdTCXrFWrCZZqorXrtwGR49+pOkaBYxtWrPTe94X/5p1E2fGEGhhGz11StkR/2JhQK21Yy20lwDJDDRxHTXaNArTHL1zCwieTWb8CBR8gMfRdV4kVcXx2r1fo7cl2gS1Ys1GggpEilZ98CYjckUefOLoMOErlr2h5caHPfCpIOTLDEm841mX6LLYtjZ0ry6OZ62VIROSAiMizLFkvQKdlQXup8tSsU2tyQPkGEP9mR2W5TfS9c848Sx68L8V/Z5cO5yBiCcDDzsJ3GbuByKZ46aCxvKUhaKhx9GheCBxrQncXJCxmQOXK8vxD4zIkIqWKiMgDGCvo1nTST2b0Nnngln6jiSOgEI+JhCuyrVeb28tyZ7sGuEpkdHxARCQuCxlxMM4TW9OqVG9oXC3PruvrbE9GMhHxkgly5nuQuXZrNLbojnfx/s/ptFNVs2iTZcp6I8ZplZ5dGxfJWXf2zfwbufl7DAxwjftg+sN/LcOrfI8F/zVdg069qLJ67OcS9V/DJy/XDK2ldXTfAL/Ry8aikUacdgOurLjQdsdF3PsgYA4AyO2kw48ZyaW73vkAPOv0/j28/xNfWOofeXUw5m5HN/Nkxj8XEZGdzthtIiL3a0wHq60Qy4yMypzEW1ChzbtLZRvUTq8QG+fsldwBgLyISCAePQZW9B0A/mrw9fcBrKHu4wgglWtk/F02u1A2PP3qxd7ja/d/jR6vmR8DrCQe+EZ3axeA41Fx0qcKYPL7ce7nRSIdAk9tDCsXD0e/wd3UhDNoUF0BuHb/KX1QXapNaHgJt6rf3Jff8WyRj2A4GMYmdnz8Ar7KHX6Tjx1A5vkBERGZ231QpCKSxD38eSGWmVHJifzmFonWdrFADrmon5V6Ws0yrYX7Qw2qpqMsYSbpURIHSSCdApkiuagg43PypIjs3akWyRGtWDDlFUsTLB2YOKJP1e1UDdImNCtpBBTlRCIlcWcVaFxExufk2VGR8pi/VPb0K5bKjlxswt7wKKoBCAPruJvaQUCwQ6pLoJXkrmqTmx1o+cblFnb3F9nhVYLH17Lkdst27XmtlqlfPbWz0eWxgVzI+zSoD/7W5hFi+r2t5Xfu0sEvjJvnN3/P73T1QlZ/vsWrXuzh+L1AuXePBlbv20OeL3Bxkb43r/WsNWT9AFDKrQIl7kIix/+0GjlamPz4AItud5jEXjHqTOz8rcfssd5Hm7dcGNxVhjSlyX/XJ7g8rcQcqLhqeYDGObSEkUfCQy5Peb1tfTiNQMnclNHQuOOnTvKPrDMf4xOwCs9cC5sqK231veKhZos0EtbDsaQQzQ5GlGyaWq82+K0QsXROo4LhizopdbqE5mDDuxfK70XkGJREZFfYWorthK+MFMoTIuHWgYruRkTkYhFdEolMXFqvlX7MEEoiQcaj20rWIGYLd63RcO7y46YkspqALF/uZx67Oh7wu+0AyorcEdjxqV/5VJ4kzM6BljpHT4vIM2FJi4igJE40aO2UxRh5ubNtYLaTAiWRkLyMip/JxA6cLn2YIe2ZOkcA5SyR1hAtqlbQ5TKb+dFHOPDyC5HN42FOkxHwHf/ZgQOOz9O4lsCR6mKwRbgaGIOFNwFmWHUwhi9s+/HaiWtPeauX+2fILU+9RRf9xIy5t9P4+wV/FuUehopK+oZRGw6rHkrkp3+WvqTOIfQ8gGCiRwMwwmB44HWd8M8ebZXNTc3fnfwxkjeJ3eqzf5bu2RWFJOLoOU0DjHWRr6x8HOKOolPLtJVdMJJkQlwPUGoLSYdeFG4ff0D/zgC+9HfILqVWvly2h9/huLCvM27qA0bN6W1J7xxNOXIqD8GRj+e8nOXDnOa4i4r/ZOdL77ybLCuO3848Kt0jIgEsSH3Jr9Rq2BT1KS9yl95ss859g0yXRHSrwdZktfL8SQWoVMXdqUsxJjrt6/xjtQaF6lFXHrGPvz7Lfu9uwl1K6bnHchuSXvUi0NChUqDMVT5UNCBn1YD6sQ2f4J0f6Oa400fkAjL0Sir6+QIk7hzQlgItG/SWEfQD8q6a0F5Ei5/1fvQel5VemiBX21MTNs9IIHSNo2cBFokP0TRw/NbkwdsRxwgMP9Kv27iZcaefUAOStO5NunJH1jajFdliDWhNDmid5Rx4TsPv29MavTYtTtb1ee7DoVGkr2nEuxgr44FB1UsOjGRINBQQrOun8p3+5MmuYghYLNBcORJrHPbWcYqujs55z3gDMkbqmuP0E75wA+a7vfRJELmhbwM8cW6UvlpdVfs2WEuvhoaxtupRzjoeuyo9duUvqtoL34CB4GHNvrRI048GMgE5vZIY4l0fAOXWWVJyWUlEjq4fkrvI1+JmzKxRmnbPlUGMjOZFBmQjrJSYwHMKQRuAVRKRCHAdMNIEWuRqhAOSvy4Fqpxm6wAHg7hlIHoPjgCxMqW/WL7r0mkNnebGMd3I0YIhEdmnSrIKcvVw53RLDrFJVsH9In2qEA9Dd95nnWOmW1IwvSIl8SlFKAOudoEDCtbhdB9K1VeQZzQWNh1wGvFaGx5FXebnex9lQeHYV7XySBYfa8reEfrAg4DPwauu9BOc+9VZLwEuFn/xDMbdk26cVcYV+FtD/xTPr9w2dDXIpjv3VFhsbpsGAw4MgnzE0qBOdx73ADL326+z7sDXkST5nrV5FPLuIg6Gewbeg0HhIxBPHwjh1FRH240LROb6LIk9uktBN2CtVVI5dYHs4cexx89KIg8YUrE5XUTkkHut3NWBCoBOsETaJEChti86U+RYZ4vEWj0h0g4ovyRle5GMqELcZ14iIl+xpGxzlojIETbJqu5C0AEqJxqRNvFQBiz5HHyv0wKMy+GTQOu5GiPIogghfi9HcMGANwGgN7NyqZf7GJifUlWzE6O0Y6zLi99XBMEsIh8BTu1ORqwh3DiUrzHRjUKC7Gb8AB8w74BPjSAbOdvaPHgoNMmiM5XzpLCbM6WisyJyHhl9lYjMslz6jesrNpvEKew7RSadBQUpFmREFWKvJLLWZXFOttubBpDd+awFu+9xh2z3adBnAvfcq/UTvkOInfbQzbLmciIsym7F+TEKl10aHl/FwmuPfvqU+67KqmRZXV26y/iEC8k4sNqzzcsHq71ZRyiH9WAQ+4au3NaNp5BWIIL39iz75f9RMSQxvzzoZw6wXCqsSRJOrTeJyDTnyt2tc2XMQsUemDxTpt0FMtmZl0GjVMmLSOycd5vI8U6ls5BfAUhYiLOskTk2icicQ5uEItNsklXW6CytpVln4IGlcsg9Uw65A3K3JRWp3CbHWVoQmTsdstC6wiDD+C4jBITNgBHQ4h/LgJvMvk6sI4cAsl47ljuIBsJyD7E75YLV/RZCuBCDqKXsg6o5hD2sciYjAs/AWeDgtxDvch63iPQ0gQrpUKhzjq8ADA1y0fcUgGdARGEMcWHlIKBgGc8GWNgQeSFLCNC+A8Y5lHsvAQvlHx0hZBH0q4H8eFGBY1BRd+37IMon9AHUWvp4wCHdO2cQYrUUtgT4MewjSDzfZ5cRucuYuIFb1KaHpe3xo0krZxGwDJcQNL+Sq1YDCIaHuwyWlPYkXUNb/RItAe53gHMYwT0zGr6XIhgQp75WLJCFO9SdMhyAXp2sn1yC/e4om8XGoSP2cbtAPprFp58nBMt87j79taS/9YpWbX8t04aIiNxt3Fi23yxH1AWxu7Q0zSbZl5lxrpd9qiAbT5mJ+5aLRH2bZJ8ako68CPFi2tQRg8zwlehbI13fVNBTtp0kAjF1QD/SPuP6YLgSRVlCByp9NqD53ZhG9v0we3xddV6TEHgcgGNGkIS1Lq4NeOB/xwEEXIOYAAzbxVMuGdHw5jc/DBiUURPqf2/wIFnuWd/CMRajjRDAwuFceVYDliabWtscDjlL85MsbDOfHCTtm4HEj0EQ3aUBwc/iEgpwOJko5v4Sm6EYQlA6C8dW9mDEyLfLeq5kb7iPJB6SqlS/vRFgobeAdJJ3Qcdw7D1oUMQsBTrAcmP06+Gs6KwvFDaonh4fAyorbciGILvagRBsVgDdYCeLge9fnUiZODYGBCpgnY/8wyLN2ExpLddlDaAIsQNZCVYBLNWh0mgDeAyAyrf7DS9Z7FoA9q3wiO7HX0hslO9TfH3XnQxiAGK3JtmIcz9Po6cCGgzN3Flu7DC5EOyO5NzYqQZYkGw2ndq8CT9jkKR/ARh7vyaJLMIk25WATv4XTF3z6G0LPIVsWUbkY4P5zBptY0B3x22TayctgEs9wMdLT4moLaDAvpfTXbAguJQocJADFuypRhuVJ21euik1yD2J2/ZbnTSVSuVKikeu+qmubYFSOnVlLwFwBXkx8sga0DZIa9QRAUQOEOEQgOGiQrgZDGfd2TB1Dqg7gJB4eCENux47l/iqJ+XI9CzCZMxjCaCRLCzU0A+W3NUF7xiBJZeA6kL1QBz2EyZt+WMLKzBgGF32rIQjOxHNAEzNDwKiz4F51VkeZJ0kO2BpIvusNAhROgRDTbOiOrAlnUh5tZZXNsr0WZIFdVMELPdQnwfrNBtlT4CGSBuu5bBsW4TZkCe1az6ur3wy98AWj5YA1LsA2nyIPXgBIrLp+o0QwwQ9aVEXnCy4RGnvtsDeDGfoJHd6twYsBzXkon7mccxx0sotTTK01vxsv34f1gPxR+BsMB2gQ6dv/Quoh91ED6e6QIbAJXy8CrTrjHQ/ylwCOfOyxylNuyBSak9KRO6tqJvB0m1YYOm1c7qaVjHA8KqMrV5apuXyVPGB3Qy2FQKGV/O2dYQsxNdESisMYIwjndX8GGRhNgOZFIevQbIdZ66GVdagHgPb/VcWJD7Zl6o6ygZEVQ1yyrEGDh4GmNPwioYkIh7FgQIYhc34YPhUd4x35H6vydb2ASxo2IUrSwBedeGACzsAmFQaXg8tvQ43QEzEr6uWk0SGIeB5mA2bSOMLAIZdOALSCQwm490KiHs9NgA4WTsFcsRC+QlHQXJrRkMnVLYB8kARHnSIN0BlhENpJeZWX4oARli1Iw0YNmUH7HQEK4N0QfnNGuauCahcp6ncCJU9sqMKtMCJh8ECVV/wbQedAKYWcbdL/CaYPM2F2fc/Q+VXNuVVmlf2pzmDAGao9KXpGQPI42/NDyGJTPqZBOg2n0oPHHqnA/90mk3lG3uY/At4sS89FzACMOsATmx2phwZahtGFkJYrUAcZLVL2YCXbr6dyqHbruE3nddw6G8c/uwtaZR5H8BUJygOpUdhYFhscDFchDaQ+4jf08/kh7TcX/ln/cRl3nlyTf48+fiDl5T/r3/a6tADlQ6AF32gBzYnDMlulohsxLhe4j1LSzK3Rsr/cIHsmSqEw2qnv3UxV/ce5Fp9oLVLffF8w+GrInOtIiK3a1DrNlppU4sYl5XkbqxROd53ekFePF0mz/un+LzbPbOdYsnvolMW0yltZiZub4+KfFPkxbeIiJwHqK0bk/kUQLKQ47/4tIbjRQ6cr3937tuMf/zk1gvb2d97Vh9H1Rs5qt5UecS4ZHpZkQfggbs0yNsAxZZqikSENxTkGe+zJXnJtvbKeQdp966SNlN5Hhl/K5i9Phl8ukwvozTXFqKJ/z4kUr4V7IVb+6pGJMKCITla+FlJ5jBuiK7unBrTNl3KywAlDxBQApkYFcN5fuaLbaMiU+1Aa1QbjURoG5DjrBCZdMwV6ottHa0sxqdwspNPWWgvRSs+cK3IrUXAqvTXgfxlo1L2PivyA1ftjNsztKPSwwEno8Um3eZFEnV7wBvKSxr2RBjdmEOfg4eRZ43Ly7IHUa8N9OpPMnZ8mfvCZS4waSyu3s/vlgPXi+iCxHu06lIe+dfESKgUwUE/vxjg/EmnDjRevkDkYJL0y8SvWb6JOktBF8C1h9zaPTMe+2qSPXSaXa1kvaq2+lEnBSuSWc/ae1RbRk1Hy5NhdmYVtXELKMioqlK2kI4PAAj8wetwgMqv9ic70gFycfyUiIgcbTqFVAhponlcSVAEWgtfwWqvAsmrZ4uIyLONKwLiNZ5wkRAoNdjEsuSnrbQKq60GVD6/JCLyGbsJp1TnwRSRGMwTDmWfF19TA8qMysQ//VhEomr+CBCNxNTOWkoEIhGUmuW1D0Z7KPs1oP4/3ysiM7e71RdKnpL55798JeKRbzKPd95W7mdXlU0zzr1rTUnkzvOqKsj7SvwTD3d6JQnIia4v03YUJp3EDlKg7aePS9xT3eSQCRAvdwKOSKgkwpSaeE4gT7paVU3G+FW+d7insPNgkqm1VEQpyJ8ERyRONQe0vlvbue1yu67bsDmbf+aqnMjiLgC8EoXwZPyIiMi2IfHIJAfIVZR/7Kx618eczT/etV6CziIAOS8XNpzJSrPfLTVF5SSEggg50ZXwZ81Ae77cjtqe6Do0pdZeATWrDCglf44ioqEkonPjB9t1E5Bn9k5EycCS16LTIlG6Eu8n3TcgZZRC4r+YceHWzgaOOF2GCdI1EhXkkrMoIoESabAaJRKlrPqmiJCTsajTazzwd7oMt+Z1kubOq+qhtSiftLOZcgeqdvYyJiMiQX6iaVsMp8twq0pKbQ/y6bnPMCNesoJGCueBKVX9BUBGvtw2H6j6N2+GiQXFGdEUmvpDXjSYEtVNIwy6wanO/Spox8oqNgMqKOxMcEzxEA1NasqJhrzoUZGfi0iUN7cZ1BYjVNCurXPSN80wabHt4qkIGodFAAoRmBItEBGJ7wkWNz5TUUdtpSbMJ5qeEJ8o2RA6n0oe5CVmp0hMQMOkZkbrNAlHmd6EoTAfEpH30zead5tkYpKBKk7mre3V1zLRulRI1uaSs7eZmAIFzWtQKS1qBqc0Ack6nYRYZ/lRQUTEF53Xea9B+qAZKSceYEYKUIXqizUg1ZEZExEJSn7Gz6T1ZHxKGG15nWvyBhLRigANQC/qZNNNsDUvInEuVEEm5SEf2qpX79jmuA5FcmmZ1P9YjLazO6qCkqmkQDkzEBGZErao+hifVWu9lslLOTdux+4kl9524TaALCU/jWNENNsAuyd/m4iI6LxOznGbMetlj7HVbZnc5FwvT3J2ls5q/Q1hA0neahacratcb+rdzwYA5e13pTtuF5heB6vRDoDntbPAo3NzlESIVYPvqYnaCj4d6DMv/cEWgHtfXfSKDWzZYc1cMsqv4ySOdzaOGc7rGL+61czPDywbDO3A6l3/51NbLIDW7E02kLuW5RnfLV9ipTr508XYAhd0m6q6kcXU84Fa/ZcXf/VjSZsY63YAjL2Oc+ge050q6AZgmtgFGx2Hj6cAlXlAvfJ294GP3/Gn6eUGgBY70pttRPVZyW47gI7FEKEyM6loW1j9mG4W7bHt1yWqBjQUgqgA+Wm9GzdZX86w31IlwCGLFQAdWDvSz3OkQM+Bl/nmmtrqoMbsXYELfP59DtjpRyG2HWMtaBA3USsWqP4GoENMcMPvLuipA6mLf4S0aL5xhQ9heohuCwrhJ23MjqR+VGgmWk1npBjUVO6XD1bPhbqalvDNxB2oGzRgeSsAFw6h+wxgzquAkcXQlZJ3HnYVyFjL+Dt/eMXXa9s9NAateM/ib/UFx041O7jZCHFoRfQ7NOtCAq2HgaBh7/HqX377uSYPqrxd8zXuU90GPp9EyPl0t9Na8tHAAfDgTkgzNwmQaOKONYd1A058xIOb3ZCuGCfLYpQOaS+2LLA0YNhtFkC31n6i+AQo6mfxvq7mA/IZjXnUeykLlu/0Qou7IEn82c5GIHKTw8s3/qSRI2t6wcxXHvFrIBpLV5JsUrQStK0ltoohUdfsAfYAsDEKIJbb+kx/pA4Ep7/tzvoScwXQJgXgtOMg6HV9bN9aIMQe3RBxcJpSGahYyXHoelZNbRn79nM1I+Jwkcgqe4/KMtpvHtUwNEzJqyhYYeWLL+PGsN8DsI/2vsMhW281b8Waw14N6NH1iXzxA7hfA1i1vm/wkl94p1Yc+361koDYwwZ1wgFvGW5UdeXZdgjzEUZOqxD9KHet2zb6oXeLtyK7oP8uDx8N3TZi5ENggiVGuvRwKLc9rDt6B8e+CC0ywZ2ed6X0K0Xe3EI+ZGB7mBsr/tmj9xwy7nSLwPywLndoRX7n3hpQvrUdWiqT3Gm4m+JOYnCT5HqWFl3weh88ZNzpuqmWm0SzNj43c1/1VvnZN+4BmcrALf4+4628hWt2Z3qPohaX283eqzbHHzsndtJck9PM0ZGLD9Yle2LXbg3W5E3bBsRpz+zA09DNSo35JNZ6x2j7dDt3upc0IhhVoOfzQzWgjsUrIPPtqS16NHYykWE4ybi8am2WIteAMn3X27XtpEBP1087TwTdRXBXT61zr8QFWkGrbNZfRVYN4tqtOot3g6YZKIG6vaV+bPfrX106SM71RTOW30DYZmJFX5Bu940sF63cSBHifreJoZqO9J/nC1WfcEvbCiB81+TtbikwwFzQDqCdNvI46ffDqqeoITGgqmhctb363a2dvu9DjtbJ9brP9PGGV9LHuupUaqAW2FZDW5W85JyJATDBb7+73QWgMrNmjQMTRMtiHf7EYahLklSY6YFhxwjT+DR/AKfmjJJpzU0lHmjQlQRI5lrtOUApcoB1sPPk6YlSw9F3YKXvSU5EAjF7PaCfrH+55VLMSbSOnMSQ98hXSyzWO14D6M+72nORIeSDFR2AFbBhAUAxG5pxA5ByobnXJ0C1fMzjme26JL2lWHk+pKeMbdMrLsJMPn6yNiNxXolHWy6qA3UD5GoJVuikux0RYUUOqlsZw4xXNDOBktF5QHV+TgAaJKd8ION1A0YRaDfDjPfpc30KIjs9OjO743xORmjLR9R2CwHQ5qKqsV+RifE1AeZLF/eTLqvdBz1MJs1Ozfl0OAm1ujV314aMRjwCYAWLQ2gFNkgnpYLs0utaP5PxCvrC51xyPuuSj2hkJN4C5A2nRXfW92SWh7QisoDpDpXFiIAhsNIFikS/iQvvNzOUddpThnLaBpBqON2RWJ5s3yWoqCC7onWtn90ZFfSFkelnssTJJp2MhD0A2fqHlBJSqnEbVovPlrcnf93kJ1WEbdbOCCcUkp1OgMrVL4RVSYC57cSP9yYnxUg/IAFQbsZIfqqGVWxsjZz2ADO+USQmtzNSQW4LlPwtyWpfPYTNJGGt0o2per8O1M4JlMhUP5HSzL7uRDYnQHnPrCEZRwrQmfmJkYV9Ax4HY9gB9/fqxI5n6mMG9Y/5BFWOarvNiRN3o/a9Fae+0bZarAaUruyNNB6IHKz6ECNJtrgtLxfcImFBRBJPqqMRAIBMRHXsPTltAVgkUpAUiBRoHqVA2aabNck0QMZj0biISFhQDUCbGwoYNaDadfU1eyuEJiR7LczzSBL41Y/LxOkCRkproZwIZTcBAcE2h36l0z1qsV83cw9e6+NgflXPTfG82CUUbHHLHtPkYZKRWnd4SdMGqZms1/VSzglA3pjckv5teO+k5J1wpwGo6IKWCtVkx5gbAvH8gyGvQQ1AFkwYC4zXfvc/T6WZ8pK4+TRpW/uWdf9BKRdw22oMBKB0+oGEP5686WZJ7Jlj81/5d5Yimuj/F5UA1n8M5P2xmCGmSEhrcxKvcQtAw02n4cJ9DaDqqKD/nUqbgICmsSQFyui2+S+dBKjxIgvwpj9a2cmI7p6cGUhGs/9owQhO8hFOaE78/X8hm+wfD+SfBKbYE9TnsKpob/gPgHY0XTkagGwTRy5jwDNQ32F/EmoaKM/xNbSQtRqH8zS6nXeA5QTqr42SgJEFLDbXIoGexlc9AEwvx0moOTdABtR+7ltpJoWwGjhKrdY6uW2vt2vOIGCgwca0T3ON1i1bnflvZ7PgJKs4uZBa3rFmeU460+SGAauNCrNe8oKmoXemoj2ewwYbWqustQOdNgYq3d1vJ3V03921LvFqs2yEjOtiWy7gGisf5hZ3ggDIeLXZ9KV+GIGtDbxNgMu+Fzcmn/F9TS8gsbITP+WkDpByBEBX9qYYo/MkAPqksI/XvQWFW7VF4Hfh5PMAWG5atpg8yHqAxYLELdEWoIzbAFimlQ3qoI1XPfQEhjXXU6tETdWrzgKZAPQ1ELDdA8intlbwaV+7ri3L40ZW7UqjystLQW0QUzPNQK0O9GXrQA3UvjZ5JZtVVmIZqya8bE2eBuctS1HPc5ig7gq11xcKq9QF/y9zxj8itixUEQAAAABJRU5ErkJggg==" style="max-width: 150px; margin-bottom: 10px;" />
                <h1 style="margin: 0; font-size: 22px; font-weight: 900;">CALLETANO RESTAURANT</h1>
                <p style="margin: 2px 0; font-size: 12px; font-weight: bold;">De: José Eliseo Calle Calle</p>
                <p style="margin: 2px 0; font-size: 11px;">C. Ampliación La Molina, Bar. Nicaragua S/N</p>
                <p style="margin: 2px 0; font-size: 11px;">Máncora - Talara - Piura</p>
                <p style="margin: 4px 0; font-size: 14px; font-weight: bold;">RUC: 10449106267</p>
                
                <div style="border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 6px 0; margin: 10px 0;">
                    <h3 style="margin: 0; font-size: 14px;">BOLETA DE VENTA ELECTRÓNICA</h3>
                    <h3 style="margin: 0; font-size: 16px;">N° ${numBoleta || 'B001-00000000'}</h3>
                </div>
            </div>
            <div style="text-align: left; font-size: 11px; margin-bottom: 15px;">
                <p style="margin: 2px 0;"><b>FECHA EMISIÓN:</b> ${fechaActual}</p>
                <p style="margin: 2px 0;"><b>CLIENTE:</b> ${cliente?.nombre || 'CLIENTES VARIOS'}</p>
                <p style="margin: 2px 0;"><b>DNI/RUC:</b> ${cliente?.documento || '00000000'}</p>
                <p style="margin: 2px 0;"><b>DIRECCIÓN:</b> ${cliente?.direccion || '-'}</p>
            </div>
        `;
    } else {
        cabeceraHTML = `
            <div class="centrado" style="margin-bottom: 10px;">
                <h2 style="margin:0">CALLETANO</h2>
                <h4 style="margin:0;font-weight:normal">RESTAURANT</h4>
            </div>
            <div class="linea"></div>
            <p style="font-size:12px;">
                <span class="negrita">Tipo:</span> <span style="background:#000;color:#fff;padding:2px 4px;">${esPrecuenta ? 'PRE-CUENTA' : 'NOTA DE VENTA'}</span><br>
                <span class="negrita">Fecha:</span> ${fechaActual}<br>
                <span class="negrita">Ref:</span> ${formatMesaName(mesa)}<br>
                <span class="negrita">Cajero:</span> ${usuarioActivo?.username || 'Caja'}
            </p>
        `;
    }

    // 🟢 PIE SUNAT (QR)
    let pieHTML = '';
    if (esBoleta) {
        // Datos para el QR oficial: RUC | TipoDoc | Serie | Numero | IGV | Total | Fecha | TipoDocCli | NumDocCli |
        const qrData = `10449106267|03|${(numBoleta||'').replace('-','|')}|0.00|${total.toFixed(2)}|${new Date().toISOString().split('T')[0]}|1|${cliente?.documento || '00000000'}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(qrData)}`;
        
        pieHTML = `
            <div style="text-align: center; margin-top: 15px; border-top: 1px dashed #000; padding-top: 15px;">
                <img src="${qrUrl}" alt="QR SUNAT" style="width: 120px; height: 120px; margin-bottom: 5px;" />
                <p style="margin: 4px 0; font-size: 10px; font-family: monospace;">Resumen: nP5lr9o1QaPALOiE4na70zqltto=</p>
                <p style="margin: 8px 0; font-size: 10px; text-align: justify;">Representación Impresa de la BOLETA DE VENTA ELECTRÓNICA. El usuario puede consultar su validez en SUNAT Virtual: <b>www.sunat.gob.pe</b> en Operaciones sin Clave SOL / Consulta de validez del CPE.</p>
                <p style="font-size: 11px; font-weight: bold; margin-top: 10px;">¡Gracias por su preferencia!</p>
            </div>
        `;
    } else {
        pieHTML = `<div class="centrado" style="margin-top: 20px;"><p style="font-size:12px;">¡Gracias por su preferencia!</p></div>`;
    }

    return `<html><head><style>@page{margin:0;}body{font-family:'Courier New',Courier,monospace;width:265px;margin:0;padding:5px 10px 5px 0px;font-size:12px;color:#000;}.negrita{font-weight:bold;}.linea{border-top:2px dashed #000;margin:10px 0;}table{width:100%;border-collapse:collapse;margin-bottom:10px;}</style></head><body>
        ${cabeceraHTML}
        <div class="linea"></div>
        <table>
            <thead><tr><th style="text-align:left;border-bottom:1px solid #000;">Cant</th><th style="text-align:left;border-bottom:1px solid #000;">Desc</th><th style="text-align:right;border-bottom:1px solid #000;">P.U</th><th style="text-align:right;border-bottom:1px solid #000;">Imp</th></tr></thead>
            <tbody>${itemsHTML}</tbody>
        </table>
        <div style="text-align:right;font-size:16px;" class="negrita">TOTAL: S/ ${total.toFixed(2)}</div>
        <div class="linea"></div>
        ${!esPrecuenta && !esBoleta ? `
          <div style="font-size:11px; margin-top:5px;">
            <span class="negrita">Métodos de Pago:</span><br>
            ${pagos.efectivo > 0 ? `EFECTIVO: S/ ${pagos.efectivo.toFixed(2)}<br>` : ''}
            ${pagos.yape > 0 ? `YAPE: S/ ${pagos.yape.toFixed(2)}<br>` : ''}
            ${pagos.plin > 0 ? `PLIN: S/ ${pagos.plin.toFixed(2)}<br>` : ''}
            ${pagos.tarjeta > 0 ? `TARJETA: S/ ${pagos.tarjeta.toFixed(2)}<br>` : ''}
          </div>` : ''}
        ${pieHTML}
    </body></html>`;
};

export const generarTicketCocina = (mesaId, items, tipoComanda, modoDomingo) => {
    let itemsHTML = '';
    const nombreMesaLimpio = formatMesaName(mesaId);
    
    items.forEach(item => { 
      const isMenu = ['entradas', 'segundos'].includes(item.categoria?.toLowerCase());
      const nombreM = `${item.nombre}${isMenu ? ' ' + (modoDomingo ? '(ALMUERZO)' : '(MENÚ)') : ''}`;
      let mod = item.modalidad !== 'local' ? `<br><small style="font-size:12px; font-weight:bold;">*[${item.modalidad.toUpperCase()}]*</small>` : '';
      let cliente = item.cliente ? `<br><small style="font-size:13px; font-weight:bold;">Enviar a: ${item.cliente.nombre} - ${item.cliente.direccion}</small>` : '';
        
      let notaLimpia = item.nota ? item.nota.replace(/\[BEBIDA:.*?\]/ig, '').trim() : '';
      let nota = notaLimpia ? `<br><span style="font-size:14px; font-weight:bold;">&nbsp;&nbsp;>> NOTA: ${notaLimpia.toUpperCase()}</span>` : '';

      itemsHTML += `<tr><td style="padding:8px 0; border-bottom:1px dashed #000; font-size:18px; font-weight:bold; vertical-align:top;">${item.cantidad}</td><td style="padding:8px 0; border-bottom:1px dashed #000; font-size:16px;"><span style="font-weight:bold;">${nombreM}</span>${mod}${cliente}${nota}</td></tr>`; 
    });

    return `<html><head><style>@page{margin:0;}body{font-family:'Courier New',Courier,monospace;width:265px;margin:0;padding:5px 10px 0px 0px;color:#000;}.centrado{text-align:center;}.linea{border-top:2px dashed #000;margin:8px 0;}table{width:100%;border-collapse:collapse;}</style></head><body><div class="centrado"><h2 style="margin:0; font-weight:bold;">COCINA</h2><h3 style="margin:5px 0; background:#000; color:#fff; padding:5px; display:inline-block; font-weight:bold; font-size:18px;">${tipoComanda.toUpperCase()}</h3></div><div class="linea"></div><p style="font-size:16px; margin:5px 0"><span style="font-weight:bold">Ref:</span> ${nombreMesaLimpio}<br><span style="font-weight:bold">Hora:</span> ${new Date().toLocaleTimeString()}</p><div class="linea"></div><table><thead><tr><th style="text-align:left; border-bottom:2px solid #000; font-size:14px; font-weight:bold;">Cant</th><th style="text-align:left; border-bottom:2px solid #000; font-size:14px; font-weight:bold;">Plato</th></tr></thead><tbody>${itemsHTML}</tbody></table></body></html>`;
};