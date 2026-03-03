
CREATE POLICY "Customers can delete own orders"
ON public.orders
FOR DELETE
USING (auth.uid() = customer_id);
