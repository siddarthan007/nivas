import fs from 'fs';

async function test() {
    try {
        console.log('Logging in as super admin...');
        const loginRes = await fetch('http://localhost:3000/api/v1/iam/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@nivas.com', password: 'password' })
        });
        const loginData = await loginRes.json();
        
        if (!loginData.data?.token) {
            console.error('Login failed:', loginData);
            return;
        }
        
        const token = loginData.data.token;
        console.log('Token acquired.');

        console.log('\nFetching Active KOTs...');
        const ordersRes = await fetch('http://localhost:3000/api/v1/orders?status=PENDING,PREPARING,READY', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const ordersData = await ordersRes.json();
        console.log('Active Orders Status:', ordersRes.status);
        console.log('Active Orders Count:', ordersData?.data?.length);

        console.log('\nFetching Specific Order...');
        const singleOrderRes = await fetch('http://localhost:3000/api/v1/orders/18a8c6a1-6422-44f0-9286-001618e2375f', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const singleOrderData = await singleOrderRes.json();
        console.log('Specific Order Status:', singleOrderRes.status);
        console.log('Specific Order ID:', singleOrderData?.data?.id);

    } catch (e) {
        console.error('Error in script:', e);
    }
}
test();
